import os
from datetime import datetime, timedelta
import jwt
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash, check_password_hash

# openpyxl, csv, ioなどは必要に応じてインポート
from openpyxl import Workbook
from io import BytesIO, StringIO
import csv

# モデルのインポートはdbの初期化後に行うのが安全な場合がある
# from models import db, Customer, Order, OrderItem, Admin, BookCache, WishlistItem

# .envファイルから環境変数を読み込む
load_dotenv()

# Flaskアプリケーションのインスタンスを作成
app = Flask(__name__)

# --- 環境変数から設定を読み込む ---
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a-fallback-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///default.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- CORS設定 ---
# アプリケーション全体にCORSを適用
CORS(app, 
     origins=[
         "https://book-order-frontend.onrender.com",
         "http://localhost:5174",
         "http://localhost:5173",
         "http://localhost:3000"
     ], 
     supports_credentials=True
 )

# --- データベースのセットアップ ---
# SQLAlchemyインスタンスをここでインポート・初期化
from models import db
db.init_app(app)

# --- アプリケーションコンテキスト内でデータベースと初期データを作成 ---
with app.app_context():
    # テーブルが存在しない場合のみ作成
    db.create_all()

    # Adminモデルをここでインポート
    from models import Admin
    
    # 初期管理者アカウントが存在しない場合のみ作成
    admin_username = os.getenv('ADMIN_USERNAME', 'admin')
    if not Admin.query.filter_by(username=admin_username).first():
        admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
        hashed_password = generate_password_hash(admin_password)
        new_admin = Admin(username=admin_username, password_hash=hashed_password)
        db.session.add(new_admin)
        db.session.commit()
        print(f"管理者アカウント '{admin_username}' を作成しました。")

# --- これより下にAPIルートを定義 ---
# (ここには、以前の回答で完成させた、すべてのAPIルートのコードを配置します)
# (可読性のため、ここではヘルスチェックと書籍検索APIのみ記載します)

from models import Customer, Order, OrderItem, BookCache, WishlistItem

@app.route('/api/health', methods=['GET'])
def health_check():
    """ヘルスチェック用エンドポイント"""
    return jsonify(status="ok"), 200

@app.route('/api/books/search', methods=['POST'])
def search_books_api():
    # (以前完成させたsearch_books_apiのコードをここに記述)
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({'error': '検索クエリが必要です'}), 400
    query = data.get('query', '')
    # ...検索ロジック...
    # (この部分は以前のコードのままで問題ありません)
    return jsonify(books=[]), 200 # 仮の応答

# (他のすべてのAPIルートも同様にこの下に配置)

# --- サーバー起動 ---
if __name__ == '__main__':
    # この部分はローカル開発でのみ使用される
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
