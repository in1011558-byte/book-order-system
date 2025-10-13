from flask import Flask, jsonify, request
from flask_cors import CORS
from models import db, Customer, Order, OrderItem, Admin, BookCache
from datetime import datetime, timedelta
import jwt
import requests
import os
from dotenv import load_dotenv
from openpyxl import Workbook
from io import BytesIO
from flask import send_file
import csv
from io import StringIO

# 環境変数の読み込み
load_dotenv()

app = Flask(__name__)

# 設定
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# CORS設定
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://book-order-frontend.onrender.com",
            "http://localhost:5174",
            "http://localhost:5173",
            "http://localhost:3000"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# OPTIONSリクエストの処理
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response
# データベース初期化
db.init_app(app)

# Google Books APIキー
GOOGLE_BOOKS_API_KEY = os.getenv('GOOGLE_BOOKS_API_KEY', '')

# データベーステーブル作成
with app.app_context():
    db.create_all()
    
    # 初期管理者アカウント作成
    admin_username = os.getenv('ADMIN_USERNAME', 'admin')
    admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
    
    existing_admin = Admin.query.filter_by(username=admin_username).first()
    if not existing_admin:
        from werkzeug.security import generate_password_hash
        admin = Admin(
            username=admin_username,
            password_hash=generate_password_hash(admin_password)
        )
        db.session.add(admin)
        db.session.commit()
        print(f"管理者アカウントを作成しました: {admin_username}")


# ================== ユーティリティ関数 ==================

def generate_token(admin_id):
    """JWT トークン生成"""
    payload = {
        'admin_id': admin_id,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


def verify_token(token):
    """JWT トークン検証"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload['admin_id']
    except:
        return None


def search_google_books(query, isbn=None):
    """Google Books APIで検索"""
    try:
        if isbn:
            # ISBNで検索
            url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
        else:
            # タイトルで検索
            url = f"https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=10"
        
        if GOOGLE_BOOKS_API_KEY:
            url += f"&key={GOOGLE_BOOKS_API_KEY}"
        
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        books = []
        if 'items' in data:
            for item in data['items']:
                volume_info = item.get('volumeInfo', {})
                
                # ISBN取得
                book_isbn = None
                for identifier in volume_info.get('industryIdentifiers', []):
                    if identifier.get('type') in ['ISBN_13', 'ISBN_10']:
                        book_isbn = identifier.get('identifier')
                        break
                
                book = {
                    'isbn': book_isbn,
                    'title': volume_info.get('title', ''),
                    'author': ', '.join(volume_info.get('authors', [])),
                    'publisher': volume_info.get('publisher', ''),
                    'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail', ''),
                    'description': volume_info.get('description', '')
                }
                books.append(book)
                
                # キャッシュに保存
                if book_isbn:
                    cached_book = BookCache.query.filter_by(isbn=book_isbn).first()
                    if not cached_book:
                        cached_book = BookCache(
                            isbn=book_isbn,
                            title=book['title'],
                            author=book['author'],
                            publisher=book['publisher'],
                            thumbnail=book['thumbnail'],
                            description=book['description']
                        )
                        db.session.add(cached_book)
            
            db.session.commit()
        
        return books
    
    except Exception as e:
        print(f"Google Books API エラー: {str(e)}")
        return []


# ================== 書籍検索API ==================

@app.route('/api/books/search', methods=['POST'])
def search_books():
    """書籍検索（テキスト・ISBN）"""
    try:
        data = request.get_json()
        query = data.get('query', '')
        search_type = data.get('type', 'title')  # title or isbn
        
        if not query:
            return jsonify({'error': '検索キーワードを入力してください'}), 400
        
        # キャッシュから検索
        if search_type == 'isbn':
            cached = BookCache.query.filter_by(isbn=query).first()
            if cached:
                return jsonify({'books': [cached.to_dict()]}), 200
        
        # Google Books APIで検索
        books = search_google_books(
            query=query if search_type == 'title' else None,
            isbn=query if search_type == 'isbn' else None
        )
        
        return jsonify({'books': books}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/books/<isbn>', methods=['GET'])
def get_book_detail(isbn):
    """書籍詳細取得"""
    try:
        # キャッシュから取得
        cached = BookCache.query.filter_by(isbn=isbn).first()
        if cached:
            return jsonify(cached.to_dict()), 200
        
        # APIから取得
        books = search_google_books(isbn=isbn)
        if books:
            return jsonify(books[0]), 200
        
        return jsonify({'error': '書籍が見つかりませんでした'}), 404
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================== 注文API ==================

@app.route('/api/orders', methods=['POST'])
def create_order():
    """注文作成"""
    try:
        data = request.get_json()
        
        # 顧客情報
        customer_data = data.get('customer', {})
        customer_name = customer_data.get('name', '')
        customer_email = customer_data.get('email', '')
        customer_phone = customer_data.get('phone', '')
        customer_org = customer_data.get('organization', '')
        
        if not customer_name:
            return jsonify({'error': '顧客名は必須です'}), 400
        
        # 顧客を検索または作成
        customer = Customer.query.filter_by(
            name=customer_name,
            email=customer_email if customer_email else None
        ).first()
        
        if not customer:
            customer = Customer(
                name=customer_name,
                email=customer_email,
                phone=customer_phone,
                organization=customer_org
            )
            db.session.add(customer)
            db.session.flush()
        
        # 注文作成
        order = Order(
            customer_id=customer.id,
            notes=data.get('notes', ''),
            total_items=len(data.get('items', []))
        )
        db.session.add(order)
        db.session.flush()
        
        # 注文明細作成
        for item_data in data.get('items', []):
            item = OrderItem(
                order_id=order.id,
                isbn=item_data.get('isbn', ''),
                title=item_data.get('title', ''),
                author=item_data.get('author', ''),
                publisher=item_data.get('publisher', ''),
                quantity=item_data.get('quantity', 1),
                thumbnail=item_data.get('thumbnail', '')
            )
            db.session.add(item)
        
        db.session.commit()
        
        return jsonify({
            'message': '注文が完了しました',
            'order_id': order.id
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/orders', methods=['GET'])
def get_orders():
    """注文履歴取得（全件）"""
    try:
        orders = Order.query.order_by(Order.order_date.desc()).all()
        return jsonify({
            'orders': [order.to_dict() for order in orders]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order_detail(order_id):
    """注文詳細取得"""
    try:
        order = Order.query.get_or_404(order_id)
        return jsonify(order.to_dict()), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================== 管理者API ==================

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """管理者ログイン"""
    try:
        from werkzeug.security import check_password_hash
        
        data = request.get_json()
        username = data.get('username', '')
        password = data.get('password', '')
        
        admin = Admin.query.filter_by(username=username).first()
        
        if admin and check_password_hash(admin.password_hash, password):
            token = generate_token(admin.id)
            return jsonify({
                'token': token,
                'username': admin.username
            }), 200
        
        return jsonify({'error': 'ユーザー名またはパスワードが正しくありません'}), 401
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/orders', methods=['GET'])
def admin_get_orders():
    """管理者：全注文取得"""
    try:
        # トークン検証
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not verify_token(token):
            return jsonify({'error': '認証が必要です'}), 401
        
        orders = Order.query.order_by(Order.order_date.desc()).all()
        return jsonify({
            'orders': [order.to_dict() for order in orders]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/customers', methods=['GET'])
def admin_get_customers():
    """管理者：顧客一覧取得"""
    try:
        # トークン検証
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not verify_token(token):
            return jsonify({'error': '認証が必要です'}), 401
        
        customers = Customer.query.all()
        result = []
        
        for customer in customers:
            customer_dict = customer.to_dict()
            customer_dict['order_count'] = len(customer.orders)
            result.append(customer_dict)
        
        return jsonify({'customers': result}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/customer/<int:customer_id>/orders', methods=['GET'])
def admin_get_customer_orders(customer_id):
    """管理者：顧客別注文履歴"""
    try:
        # トークン検証
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not verify_token(token):
            return jsonify({'error': '認証が必要です'}), 401
        
        customer = Customer.query.get_or_404(customer_id)
        orders = Order.query.filter_by(customer_id=customer_id).order_by(Order.order_date.desc()).all()
        
        return jsonify({
            'customer': customer.to_dict(),
            'orders': [order.to_dict() for order in orders]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/export/csv', methods=['GET'])
def export_csv():
    """CSV出力"""
    try:
        # トークン検証
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not verify_token(token):
            return jsonify({'error': '認証が必要です'}), 401
        
        orders = Order.query.order_by(Order.order_date.desc()).all()
        
        # CSV作成
        si = StringIO()
        writer = csv.writer(si)
        writer.writerow(['注文ID', '注文日', '顧客名', '組織', 'ISBN', '書名', '著者', '出版社', '数量'])
        
        for order in orders:
            for item in order.items:
                writer.writerow([
                    order.id,
                    order.order_date.strftime('%Y-%m-%d %H:%M'),
                    order.customer.name,
                    order.customer.organization or '',
                    item.isbn or '',
                    item.title,
                    item.author or '',
                    item.publisher or '',
                    item.quantity
                ])
        
        output = BytesIO()
        output.write(si.getvalue().encode('utf-8-sig'))
        output.seek(0)
        
        return send_file(
            output,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'orders_{datetime.now().strftime("%Y%m%d")}.csv'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/export/excel', methods=['GET'])
def export_excel():
    """Excel出力"""
    try:
        # トークン検証
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not verify_token(token):
            return jsonify({'error': '認証が必要です'}), 401
        
        orders = Order.query.order_by(Order.order_date.desc()).all()
        
        # Excelワークブック作成
        wb = Workbook()
        ws = wb.active
        ws.title = "注文一覧"
        
        # ヘッダー
        ws.append(['注文ID', '注文日', '顧客名', '組織', 'ISBN', '書名', '著者', '出版社', '数量'])
        
        # データ
        for order in orders:
            for item in order.items:
                ws.append([
                    order.id,
                    order.order_date.strftime('%Y-%m-%d %H:%M'),
                    order.customer.name,
                    order.customer.organization or '',
                    item.isbn or '',
                    item.title,
                    item.author or '',
                    item.publisher or '',
                    item.quantity
                ])
        
        # バイナリ出力
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'orders_{datetime.now().strftime("%Y%m%d")}.xlsx'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================== ヘルスチェック ==================

@app.route('/api/health', methods=['GET'])
def health_check():
    """ヘルスチェック"""
    return jsonify({'status': 'ok'}), 200


@app.route('/', methods=['GET'])
def index():
    """ルート"""
    return jsonify({
        'message': '書籍注文システム API',
        'version': '1.0.0'
    }), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)