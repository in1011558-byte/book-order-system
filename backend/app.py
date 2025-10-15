from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import jwt
import requests
import os
from dotenv import load_dotenv
from openpyxl import Workbook
from io import BytesIO, StringIO
import csv
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

from models import db, Customer, Order, OrderItem, Admin, User, BookCache, BookSelectionList, BookSelectionItem, WishlistItem

load_dotenv()

app = Flask(__name__)

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# CORS設定 - シンプル版
CORS(app)

# すべてのOPTIONSリクエストに対応
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response, 200

@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response

db.init_app(app)

GOOGLE_BOOKS_API_KEY = os.getenv('GOOGLE_BOOKS_API_KEY', '')

with app.app_context():
    db.create_all()
    admin_username = os.getenv('ADMIN_USERNAME', 'admin')
    admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
    if not Admin.query.filter_by(username=admin_username).first():
        admin = Admin(username=admin_username, password_hash=generate_password_hash(admin_password))
        db.session.add(admin)
        db.session.commit()
        print(f"管理者アカウントを作成しました: {admin_username}")

def generate_token(admin_id):
    payload = {'admin_id': admin_id, 'exp': datetime.utcnow() + timedelta(days=7)}
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload['admin_id']
    except:
        return None

def generate_user_token(user_id):
    payload = {'user_id': user_id, 'exp': datetime.utcnow() + timedelta(days=30)}
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_user_token(token):
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload['user_id']
    except:
        return None

def search_google_books(query=None, isbn=None):
    try:
        if isbn:
            url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
        elif query:
            url = f"https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=10"
        else:
            return []
        
        if GOOGLE_BOOKS_API_KEY:
            url += f"&key={GOOGLE_BOOKS_API_KEY}"
        
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        books = []
        if 'items' in data:
            for item in data['items']:
                volume_info = item.get('volumeInfo', {})
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
                
                if book_isbn and not BookCache.query.filter_by(isbn=book_isbn).first():
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
        db.session.rollback()
        return []

@app.route('/api/books/search', methods=['POST', 'OPTIONS'])
def search_books_api():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    data = request.get_json()
    query = data.get('query', '')
    filters = data.get('filters', {})
    
    if not query:
        return jsonify({'error': '検索キーワードを入力してください'}), 400
    
    is_isbn = query.replace('-', '').isdigit() and len(query.replace('-', '')) in [10, 13]
    books = []
    
    if is_isbn:
        cached = BookCache.query.filter_by(isbn=query).first()
        if cached:
            books = [cached.to_dict()]
        if not books:
            books = search_google_books(isbn=query)
    else:
        # キャッシュから検索
        cache_query = BookCache.query
        
        # テキスト検索
        if query:
            cache_query = cache_query.filter(
                (BookCache.title.contains(query)) |
                (BookCache.author.contains(query)) |
                (BookCache.publisher.contains(query))
            )
        
        # フィルタリング
        if filters.get('target_audience'):
            cache_query = cache_query.filter(BookCache.target_audience == filters['target_audience'])
        
        if filters.get('genre'):
            cache_query = cache_query.filter(BookCache.genre == filters['genre'])
        
        if filters.get('price_min'):
            cache_query = cache_query.filter(BookCache.price >= filters['price_min'])
        
        if filters.get('price_max'):
            cache_query = cache_query.filter(BookCache.price <= filters['price_max'])
        
        cached_books = cache_query.limit(20).all()
        books = [book.to_dict() for book in cached_books]
        
        # キャッシュに十分な結果がない場合はGoogle Books APIも使用
        if len(books) < 5:
            google_books = search_google_books(query=query)
            books.extend(google_books)
    
    return jsonify({'books': books}), 200

@app.route('/api/books/filters', methods=['GET', 'OPTIONS'])
def get_search_filters():
    """検索フィルタの選択肢を取得"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    # 利用対象の選択肢
    target_audiences = [
        '未就学',
        '小学校低学年',
        '小学校中学年', 
        '小学校高学年',
        '中学生',
        '高校生',
        '一般',
        '教員',
        '保護者'
    ]
    
    # ジャンルの選択肢
    genres = [
        '事典・辞書',
        '国際理解',
        '社会科',
        '理科・科学',
        '読み物',
        'ノンフィクション',
        '伝記・偉人',
        '歴史',
        '地理',
        '環境・自然',
        '平和・戦争',
        '教師用',
        '特別支援用',
        'その他'
    ]
    
    return jsonify({
        'target_audiences': target_audiences,
        'genres': genres
    }), 200

@app.route('/api/books/<isbn>', methods=['GET', 'OPTIONS'])
def get_book_detail(isbn):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    cached = BookCache.query.filter_by(isbn=isbn).first()
    if cached:
        return jsonify(cached.to_dict()), 200
    books = search_google_books(isbn=isbn)
    if books:
        return jsonify(books[0]), 200
    return jsonify({'error': '書籍が見つかりませんでした'}), 404

@app.route('/api/orders', methods=['POST', 'OPTIONS'])
def create_order():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        data = request.get_json()
        customer_data = data.get('customer', {})
        customer_name = customer_data.get('name')
        if not customer_name:
            return jsonify({'error': '顧客名は必須です'}), 400
        
        customer = Customer.query.filter_by(
            name=customer_name,
            email=customer_data.get('email')
        ).first()
        
        if not customer:
            customer = Customer(
                name=customer_name,
                email=customer_data.get('email'),
                phone=customer_data.get('phone'),
                organization=customer_data.get('organization')
            )
            db.session.add(customer)
            db.session.flush()
        
        order = Order(
            customer_id=customer.id,
            notes=data.get('notes', ''),
            total_items=len(data.get('items', []))
        )
        db.session.add(order)
        db.session.flush()
        
        for item_data in data.get('items', []):
            item = OrderItem(
                order_id=order.id,
                isbn=item_data.get('isbn'),
                title=item_data.get('title'),
                author=item_data.get('author'),
                publisher=item_data.get('publisher'),
                quantity=item_data.get('quantity', 1),
                thumbnail=item_data.get('thumbnail')
            )
            db.session.add(item)
        
        db.session.commit()
        return jsonify({'message': '注文が完了しました', 'order_id': order.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ユーザー認証API
@app.route('/api/register', methods=['POST', 'OPTIONS'])
def user_register():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not username or not email or not password:
            return jsonify({'error': '必須項目が不足しています'}), 400
        
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'このユーザー名はすでに使用されています'}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'このメールアドレスはすでに使用されています'}), 400
        
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            full_name=data.get('full_name'),
            organization=data.get('organization'),
            phone=data.get('phone')
        )
        db.session.add(user)
        db.session.commit()
        
        token = generate_user_token(user.id)
        return jsonify({
            'message': '登録が完了しました',
            'token': token,
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST', 'OPTIONS'])
def user_login():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    data = request.get_json()
    username_or_email = data.get('username')
    password = data.get('password')
    
    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()
    
    if user and check_password_hash(user.password_hash, password):
        if not user.is_active:
            return jsonify({'error': 'アカウントが無効です'}), 401
        
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        token = generate_user_token(user.id)
        return jsonify({
            'token': token,
            'user': user.to_dict()
        }), 200
    
    return jsonify({'error': 'ユーザー名またはパスワードが正しくありません'}), 401

@app.route('/api/user/profile', methods=['GET', 'OPTIONS'])
def get_user_profile():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    user_id = verify_user_token(request.headers.get('Authorization', '').replace('Bearer ', ''))
    if not user_id:
        return jsonify({'error': '認証が必要です'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'ユーザーが見つかりません'}), 404
    
    return jsonify({'user': user.to_dict()}), 200

@app.route('/api/admin/login', methods=['POST', 'OPTIONS'])
def admin_login():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    data = request.get_json()
    admin = Admin.query.filter_by(username=data.get('username')).first()
    if admin and check_password_hash(admin.password_hash, data.get('password')):
        token = generate_token(admin.id)
        return jsonify({'token': token, 'username': admin.username}), 200
    return jsonify({'error': 'ユーザー名またはパスワードが正しくありません'}), 401

@app.route('/api/admin/orders', methods=['GET', 'OPTIONS'])
def admin_get_orders():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    if not verify_token(request.headers.get('Authorization', '').replace('Bearer ', '')):
        return jsonify({'error': '認証が必要です'}), 401
    orders = Order.query.order_by(Order.order_date.desc()).all()
    return jsonify({'orders': [order.to_dict() for order in orders]}), 200

@app.route('/api/admin/customers', methods=['GET', 'OPTIONS'])
def admin_get_customers():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    if not verify_token(request.headers.get('Authorization', '').replace('Bearer ', '')):
        return jsonify({'error': '認証が必要です'}), 401
    customers = Customer.query.all()
    result = []
    for c in customers:
        customer_dict = c.to_dict()
        customer_dict['order_count'] = Order.query.filter_by(customer_id=c.id).count()
        result.append(customer_dict)
    return jsonify({'customers': result}), 200

@app.route('/api/admin/customer/<int:customer_id>/orders', methods=['GET', 'OPTIONS'])
def admin_get_customer_orders(customer_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    if not verify_token(request.headers.get('Authorization', '').replace('Bearer ', '')):
        return jsonify({'error': '認証が必要です'}), 401
    customer = Customer.query.get_or_404(customer_id)
    orders = Order.query.filter_by(customer_id=customer_id).order_by(Order.order_date.desc()).all()
    return jsonify({
        'customer': customer.to_dict(),
        'orders': [o.to_dict() for o in orders]
    }), 200

@app.route('/api/admin/export/csv', methods=['GET', 'OPTIONS'])
def export_csv():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    if not verify_token(request.headers.get('Authorization', '').replace('Bearer ', '')):
        return jsonify({'error': '認証が必要です'}), 401
    
    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(['注文ID', '注文日', '顧客名', '組織', 'ISBN', '書名', '著者', '出版社', '数量'])
    orders = Order.query.order_by(Order.order_date.desc()).all()
    for order in orders:
        for item in order.items:
            writer.writerow([
                order.id,
                order.order_date.strftime('%Y-%m-%d'),
                order.customer.name,
                order.customer.organization or '',
                item.isbn or '',
                item.title,
                item.author or '',
                item.publisher or '',
                item.quantity
            ])
    
    output = BytesIO(si.getvalue().encode('utf-8-sig'))
    output.seek(0)
    return send_file(output, mimetype='text/csv', as_attachment=True,
                     download_name=f'orders_{datetime.now().strftime("%Y%m%d")}.csv')

# 選書リスト管理API
@app.route('/api/selection-lists', methods=['GET', 'POST', 'OPTIONS'])
def manage_selection_lists():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    user_id = verify_user_token(request.headers.get('Authorization', '').replace('Bearer ', ''))
    if not user_id:
        return jsonify({'error': '認証が必要です'}), 401
    
    if request.method == 'GET':
        # ユーザーの選書リスト一覧を取得
        lists = BookSelectionList.query.filter_by(user_id=user_id).order_by(BookSelectionList.updated_at.desc()).all()
        return jsonify({'lists': [book_list.to_dict() for book_list in lists]}), 200
    
    elif request.method == 'POST':
        # 新しい選書リストを作成
        try:
            data = request.get_json()
            name = data.get('name')
            if not name:
                return jsonify({'error': 'リスト名は必須です'}), 400
            
            book_list = BookSelectionList(
                user_id=user_id,
                name=name,
                description=data.get('description', '')
            )
            db.session.add(book_list)
            db.session.commit()
            
            return jsonify({
                'message': '選書リストを作成しました',
                'list': book_list.to_dict()
            }), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/api/selection-lists/<int:list_id>', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
def manage_selection_list(list_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    user_id = verify_user_token(request.headers.get('Authorization', '').replace('Bearer ', ''))
    if not user_id:
        return jsonify({'error': '認証が必要です'}), 401
    
    book_list = BookSelectionList.query.filter_by(id=list_id, user_id=user_id).first()
    if not book_list:
        return jsonify({'error': '選書リストが見つかりません'}), 404
    
    if request.method == 'GET':
        # 選書リストの詳細を取得
        return jsonify({'list': book_list.to_dict()}), 200
    
    elif request.method == 'PUT':
        # 選書リストの情報を更新
        try:
            data = request.get_json()
            if 'name' in data:
                book_list.name = data['name']
            if 'description' in data:
                book_list.description = data['description']
            book_list.updated_at = datetime.utcnow()
            db.session.commit()
            return jsonify({'message': '選書リストを更新しました', 'list': book_list.to_dict()}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'DELETE':
        # 選書リストを削除
        try:
            db.session.delete(book_list)
            db.session.commit()
            return jsonify({'message': '選書リストを削除しました'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/api/selection-lists/<int:list_id>/items', methods=['GET', 'POST', 'OPTIONS'])
def manage_selection_list_items(list_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    user_id = verify_user_token(request.headers.get('Authorization', '').replace('Bearer ', ''))
    if not user_id:
        return jsonify({'error': '認証が必要です'}), 401
    
    book_list = BookSelectionList.query.filter_by(id=list_id, user_id=user_id).first()
    if not book_list:
        return jsonify({'error': '選書リストが見つかりません'}), 404
    
    if request.method == 'GET':
        # リストのアイテム一覧を取得
        items = BookSelectionItem.query.filter_by(list_id=list_id).order_by(BookSelectionItem.added_at.desc()).all()
        return jsonify({'items': [item.to_dict() for item in items]}), 200
    
    elif request.method == 'POST':
        # リストにアイテムを追加
        try:
            data = request.get_json()
            isbn = data.get('isbn')
            title = data.get('title')
            
            if not isbn or not title:
                return jsonify({'error': 'ISBNと書名は必須です'}), 400
            
            # 既存チェック
            existing_item = BookSelectionItem.query.filter_by(list_id=list_id, isbn=isbn).first()
            if existing_item:
                return jsonify({'error': 'この書籍は既にリストに追加されています'}), 400
            
            item = BookSelectionItem(
                list_id=list_id,
                isbn=isbn,
                title=title,
                author=data.get('author'),
                publisher=data.get('publisher'),
                price=data.get('price'),
                volume_count=data.get('volume_count', 1),
                is_set_only=data.get('is_set_only', False),
                thumbnail=data.get('thumbnail'),
                quantity=data.get('quantity', 1)
            )
            db.session.add(item)
            book_list.updated_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'message': '書籍をリストに追加しました',
                'item': item.to_dict()
            }), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/api/selection-lists/<int:list_id>/items/<int:item_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def manage_selection_list_item(list_id, item_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    user_id = verify_user_token(request.headers.get('Authorization', '').replace('Bearer ', ''))
    if not user_id:
        return jsonify({'error': '認証が必要です'}), 401
    
    book_list = BookSelectionList.query.filter_by(id=list_id, user_id=user_id).first()
    if not book_list:
        return jsonify({'error': '選書リストが見つかりません'}), 404
    
    item = BookSelectionItem.query.filter_by(id=item_id, list_id=list_id).first()
    if not item:
        return jsonify({'error': 'アイテムが見つかりません'}), 404
    
    if request.method == 'PUT':
        # アイテムの数量を更新
        try:
            data = request.get_json()
            if 'quantity' in data:
                quantity = int(data['quantity'])
                if quantity < 1:
                    return jsonify({'error': '数量は1以上である必要があります'}), 400
                item.quantity = quantity
                book_list.updated_at = datetime.utcnow()
                db.session.commit()
            return jsonify({'message': '数量を更新しました', 'item': item.to_dict()}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'DELETE':
        # アイテムをリストから削除
        try:
            db.session.delete(item)
            book_list.updated_at = datetime.utcnow()
            db.session.commit()
            return jsonify({'message': 'アイテムをリストから削除しました'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

# 書店向け注文データ出力API
@app.route('/api/selection-lists/<int:list_id>/export/csv', methods=['GET', 'OPTIONS'])
def export_selection_list_csv(list_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    user_id = verify_user_token(request.headers.get('Authorization', '').replace('Bearer ', ''))
    if not user_id:
        return jsonify({'error': '認証が必要です'}), 401
    
    book_list = BookSelectionList.query.filter_by(id=list_id, user_id=user_id).first()
    if not book_list:
        return jsonify({'error': '選書リストが見つかりません'}), 404
    
    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(['ISBN', '書名', '著者', '出版社', '本体価格（税別）', '数量', '合計金額（税別）'])
    
    total_amount = 0
    for item in book_list.items:
        subtotal = (item.price or 0) * item.quantity
        total_amount += subtotal
        writer.writerow([
            item.isbn or '',
            item.title,
            item.author or '',
            item.publisher or '',
            item.price or 0,
            item.quantity,
            subtotal
        ])
    
    writer.writerow([])  # 空行
    writer.writerow(['合計', '', '', '', '', '', total_amount])
    
    output = BytesIO(si.getvalue().encode('utf-8-sig'))
    output.seek(0)
    return send_file(output, 
                     mimetype='text/csv', 
                     as_attachment=True,
                     download_name=f'selection_list_{list_id}_{datetime.now().strftime("%Y%m%d")}.csv')

@app.route('/api/selection-lists/<int:list_id>/export/pdf', methods=['GET', 'OPTIONS'])
def export_selection_list_pdf(list_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    user_id = verify_user_token(request.headers.get('Authorization', '').replace('Bearer ', ''))
    if not user_id:
        return jsonify({'error': '認証が必要です'}), 401
    
    book_list = BookSelectionList.query.filter_by(id=list_id, user_id=user_id).first()
    if not book_list:
        return jsonify({'error': '選書リストが見つかりません'}), 404
    
    user = User.query.get(user_id)
    
    # PDF生成
    buffer = BytesIO()
    
    # 日本語フォント登録
    try:
        pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
        font_name = 'HeiseiKakuGo-W5'
    except:
        font_name = 'Helvetica'  # フォールバック
    
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName=font_name,
        fontSize=16,
        spaceAfter=20,
        alignment=1  # センター揃え
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10,
        spaceAfter=6
    )
    
    # タイトル
    story.append(Paragraph('図書注文書', title_style))
    story.append(Spacer(1, 20))
    
    # 注文者情報
    story.append(Paragraph(f'注文者: {user.full_name or user.username}', normal_style))
    if user.organization:
        story.append(Paragraph(f'所属: {user.organization}', normal_style))
    story.append(Paragraph(f'メール: {user.email}', normal_style))
    if user.phone:
        story.append(Paragraph(f'電話: {user.phone}', normal_style))
    
    story.append(Spacer(1, 20))
    
    # リスト情報
    story.append(Paragraph(f'選書リスト名: {book_list.name}', normal_style))
    story.append(Paragraph(f'作成日: {book_list.created_at.strftime("%Y年%m月%d日")}', normal_style))
    story.append(Spacer(1, 20))
    
    # 書籍リスト
    if book_list.items:
        data = [['ISBN', '書名', '著者', '出版社', '本体価格', '数量', '小計']]
        total_amount = 0
        
        for item in book_list.items:
            subtotal = (item.price or 0) * item.quantity
            total_amount += subtotal
            data.append([
                item.isbn or '',
                item.title[:30] + '...' if len(item.title) > 30 else item.title,
                item.author[:20] + '...' if item.author and len(item.author) > 20 else (item.author or ''),
                item.publisher[:15] + '...' if item.publisher and len(item.publisher) > 15 else (item.publisher or ''),
                f'¥{item.price:,.0f}' if item.price else '未定',
                str(item.quantity),
                f'¥{subtotal:,.0f}' if item.price else '未定'
            ])
        
        data.append(['', '', '', '', '', '合計', f'¥{total_amount:,.0f}'])
        
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
    
    doc.build(story)
    buffer.seek(0)
    
    return send_file(buffer,
                     mimetype='application/pdf',
                     as_attachment=True,
                     download_name=f'order_{book_list.name}_{datetime.now().strftime("%Y%m%d")}.pdf')

@app.route('/api/selection-lists/<int:list_id>/export/order-data', methods=['GET', 'OPTIONS'])
def get_selection_list_order_data(list_id):
    """選書リストの注文確認データを取得"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    user_id = verify_user_token(request.headers.get('Authorization', '').replace('Bearer ', ''))
    if not user_id:
        return jsonify({'error': '認証が必要です'}), 401
    
    book_list = BookSelectionList.query.filter_by(id=list_id, user_id=user_id).first()
    if not book_list:
        return jsonify({'error': '選書リストが見つかりません'}), 404
    
    user = User.query.get(user_id)
    total_amount = sum((item.price or 0) * item.quantity for item in book_list.items)
    total_quantity = sum(item.quantity for item in book_list.items)
    
    return jsonify({
        'list_info': {
            'id': book_list.id,
            'name': book_list.name,
            'description': book_list.description,
            'created_at': book_list.created_at.isoformat(),
            'updated_at': book_list.updated_at.isoformat()
        },
        'user_info': {
            'name': user.full_name or user.username,
            'email': user.email,
            'organization': user.organization,
            'phone': user.phone
        },
        'summary': {
            'total_items': len(book_list.items),
            'total_quantity': total_quantity,
            'total_amount': total_amount
        },
        'items': [item.to_dict() for item in book_list.items]
    }), 200

@app.route('/api/admin/export/excel', methods=['GET', 'OPTIONS'])
def export_excel():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    if not verify_token(request.headers.get('Authorization', '').replace('Bearer ', '')):
        return jsonify({'error': '認証が必要です'}), 401
    
    wb = Workbook()
    ws = wb.active
    ws.title = "注文一覧"
    ws.append(['注文ID', '注文日', '顧客名', '組織', 'ISBN', '書名', '著者', '出版社', '数量'])
    orders = Order.query.order_by(Order.order_date.desc()).all()
    for order in orders:
        for item in order.items:
            ws.append([
                order.id,
                order.order_date.strftime('%Y-%m-%d'),
                order.customer.name,
                order.customer.organization or '',
                item.isbn or '',
                item.title,
                item.author or '',
                item.publisher or '',
                item.quantity
            ])
    
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return send_file(output,
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                     as_attachment=True,
                     download_name=f'orders_{datetime.now().strftime("%Y%m%d")}.xlsx')

@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    return jsonify({'status': 'ok'}), 200

@app.route('/', methods=['GET'])
def index():
    return jsonify({'message': '書籍注文システム API', 'version': '1.0.0'}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)