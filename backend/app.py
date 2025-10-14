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

from models import db, Customer, Order, OrderItem, Admin, BookCache

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
        books = search_google_books(query=query)
    
    return jsonify({'books': books}), 200

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