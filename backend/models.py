from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Customer(db.Model):
    """顧客情報"""
    __tablename__ = 'customers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    organization = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    orders = db.relationship('Order', backref='customer', lazy=True, cascade='all, delete-orphan')
    # WishlistItemとの関連付けを追加
    wishlist_items = db.relationship('WishlistItem', backref='customer', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'organization': self.organization,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Order(db.Model):
    """注文情報"""
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    order_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')
    total_items = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)
    
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'customer_name': self.customer.name if self.customer else None,
            'order_date': self.order_date.isoformat() if self.order_date else None,
            'status': self.status,
            'total_items': self.total_items,
            'notes': self.notes,
            'items': [item.to_dict() for item in self.items]
        }

class OrderItem(db.Model):
    """注文明細"""
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    isbn = db.Column(db.String(20))
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200))
    publisher = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=1)
    price = db.Column(db.Float)
    thumbnail = db.Column(db.String(500))
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'isbn': self.isbn,
            'title': self.title,
            'author': self.author,
            'publisher': self.publisher,
            'quantity': self.quantity,
            'price': self.price,
            'thumbnail': self.thumbnail
        }

class User(db.Model):
    """一般ユーザーアカウント"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(100))
    organization = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # 選書リストとの関係
    selection_lists = db.relationship('BookSelectionList', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'organization': self.organization,
            'phone': self.phone,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }

class Admin(db.Model):
    """管理者アカウント"""
    __tablename__ = 'admins'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class BookCache(db.Model):
    """書籍キャッシュ"""
    __tablename__ = 'book_cache'
    
    id = db.Column(db.Integer, primary_key=True)
    isbn = db.Column(db.String(20), unique=True, nullable=False, index=True)
    title = db.Column(db.String(200))
    author = db.Column(db.String(200))
    publisher = db.Column(db.String(100))
    published_date = db.Column(db.String(20))
    thumbnail = db.Column(db.String(500))
    description = db.Column(db.Text)
    # 分類・フィルタリング用フィールド
    target_audience = db.Column(db.String(50))  # 利用対象（未就学、小学校低学年、中学生等）
    genre = db.Column(db.String(50))  # ジャンル（事典・辞書、国際理解、社会科等）
    price = db.Column(db.Float)  # 税別価格
    volume_count = db.Column(db.Integer, default=1)  # 全巻数
    is_set_only = db.Column(db.Boolean, default=False)  # セットのみ販売
    cached_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'isbn': self.isbn,
            'title': self.title,
            'author': self.author,
            'publisher': self.publisher,
            'published_date': self.published_date,
            'thumbnail': self.thumbnail,
            'description': self.description,
            'target_audience': self.target_audience,
            'genre': self.genre,
            'price': self.price,
            'volume_count': self.volume_count,
            'is_set_only': self.is_set_only
        }

class BookSelectionList(db.Model):
    """選書リスト"""
    __tablename__ = 'book_selection_lists'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # リスト名
    description = db.Column(db.Text)  # リストの説明
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # リストアイテムとの関係
    items = db.relationship('BookSelectionItem', backref='book_list', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'items_count': len(self.items),
            'total_quantity': sum(item.quantity for item in self.items),
            'total_amount': sum((item.price or 0) * item.quantity for item in self.items),
            'items': [item.to_dict() for item in self.items]
        }

class BookSelectionItem(db.Model):
    """選書リストのアイテム"""
    __tablename__ = 'book_selection_items'
    
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('book_selection_lists.id'), nullable=False)
    isbn = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200))
    publisher = db.Column(db.String(100))
    price = db.Column(db.Float)  # 税別価格
    volume_count = db.Column(db.Integer, default=1)  # 全巻数（セット商品用）
    is_set_only = db.Column(db.Boolean, default=False)  # セットのみ販売
    thumbnail = db.Column(db.String(500))
    quantity = db.Column(db.Integer, default=1)  # 選択数量
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 複合ユニーク制約: 同じリストに同じ本は1つまで
    __table_args__ = (db.UniqueConstraint('list_id', 'isbn', name='_list_isbn_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'list_id': self.list_id,
            'isbn': self.isbn,
            'title': self.title,
            'author': self.author,
            'publisher': self.publisher,
            'price': self.price,
            'volume_count': self.volume_count,
            'is_set_only': self.is_set_only,
            'thumbnail': self.thumbnail,
            'quantity': self.quantity,
            'added_at': self.added_at.isoformat() if self.added_at else None,
            'subtotal': (self.price or 0) * self.quantity
        }

class WishlistItem(db.Model):
    """一時リスト（ウィッシュリスト）のアイテム - 後方互換性のために残す"""
    __tablename__ = 'wishlist_items'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    isbn = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200))
    publisher = db.Column(db.String(100))
    thumbnail = db.Column(db.String(500))
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 複合ユニーク制約: 同じ顧客が同じ本を複数追加できないようにする
    __table_args__ = (db.UniqueConstraint('customer_id', 'isbn', name='_customer_isbn_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'isbn': self.isbn,
            'title': self.title,
            'author': self.author,
            'publisher': self.publisher,
            'thumbnail': self.thumbnail,
            'added_at': self.added_at.isoformat()
        }
