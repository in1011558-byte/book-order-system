import os
from datetime import datetime, timedelta
import jwt
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS, cross_origin # cross_originをインポート
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash, check_password_hash

from openpyxl import Workbook
from io import BytesIO, StringIO
import csv

load_dotenv()

app = Flask(__name__)

# --- 設定 ---
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a-fallback-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///default.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- CORS設定 ---
# ここでは基本的なCORS設定を適用
CORS(app, supports_credentials=True)

# --- データベース ---
from models import db
db.init_app(app)

# --- アプリケーションコンテキスト ---
with app.app_context():
    db.create_all()
    from models import Admin
    admin_username = os.getenv('ADMIN_USERNAME', 'admin')
    if not Admin.query.filter_by(username=admin_username).first():
        admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
        hashed_password = generate_password_hash(admin_password)
        new_admin = Admin(username=admin_username, password_hash=hashed_password)
        db.session.add(new_admin)
        db.session.commit()

# --- モデルのインポート ---
from models import Customer, Order, OrderItem, BookCache, WishlistItem

# =====================================================
#  APIルート定義 - ここからが重要な修正
# =====================================================

# すべてのルートに @cross_origin() デコレータを追加し、
# methodsに 'OPTIONS' を追加します。

@app.route('/api/health', methods=['GET', 'OPTIONS'])
@cross_origin()
def health_check():
    return jsonify(status="ok"), 200

@app.route('/api/books/search', methods=['POST', 'OPTIONS'])
@cross_origin()
def search_books_api():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    # (ここから下のロジックは元のまま)
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({'error': '検索クエリが必要です'}), 400
    query = data.get('query', '')
    
    is_isbn = query.replace('-', '').isdigit() and len(query.replace('-', '')) in [10, 13]
    books = []
    if is_isbn:
        cached = BookCache.query.filter_by(isbn=query).first()
        if cached: books = [cached.to_dict()]
        if not books: books = search_google_books(isbn=query) # search_google_booksは別途定義が必要
    else:
        books = search_google_books(query=query)
        
    return jsonify({'books': books}), 200

@app.route('/api/books/<isbn>', methods=['GET', 'OPTIONS'])
@cross_origin()
def get_book_detail(isbn):
    # (元のコードをここに記述)
    cached = BookCache.query.filter_by(isbn=isbn).first()
    if cached: return jsonify(cached.to_dict()), 200
    books = search_google_books(isbn=isbn)
    if books: return jsonify(books[0]), 200
    return jsonify({'error': '書籍が見つかりませんでした'}), 404

@app.route('/api/orders', methods=['POST', 'OPTIONS'])
@cross_origin()
def create_order():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    # (元のコードをここに記述)
    # ...
    return jsonify({'message': '注文が完了しました'}), 201

# ... 以下、すべてのAPIルートに同様の修正を加えてください ...
# @app.route('/api/wishlist', methods=['POST', 'OPTIONS'])
# @cross_origin()
# def add_to_wishlist(): ...

# @app.route('/api/admin/login', methods=['POST', 'OPTIONS'])
# @cross_origin()
# def admin_login(): ...

# (ユーティリティ関数 search_google_books なども忘れずに記述してください)
def search_google_books(query=None, isbn=None):
    # (この関数の実装は元のままでOK)
    # ...
    return []

# --- サーバー起動 ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
