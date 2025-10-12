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
    organization = db.Column(db.String(100))  # 学校名・塾名
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    orders = db.relationship('Order', backref='customer', lazy=True, cascade='all, delete-orphan')
    
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
    status = db.Column(db.String(20), default='pending')  # pending, confirmed, shipped, completed
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
    """書籍キャッシュ（検索結果の保存）"""
    __tablename__ = 'book_cache'
    
    id = db.Column(db.Integer, primary_key=True)
    isbn = db.Column(db.String(20), unique=True, nullable=False, index=True)
    title = db.Column(db.String(200))
    author = db.Column(db.String(200))
    publisher = db.Column(db.String(100))
    published_date = db.Column(db.String(20))
    thumbnail = db.Column(db.String(500))
    description = db.Column(db.Text)
    cached_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'isbn': self.isbn,
            'title': self.title,
            'author': self.author,
            'publisher': self.publisher,
            'published_date': self.published_date,
            'thumbnail': self.thumbnail,
            'description': self.description
        }