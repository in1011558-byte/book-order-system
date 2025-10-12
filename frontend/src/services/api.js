import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

class BookOrderAPI {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // トークンを自動的に追加
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('admin_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // 書籍検索
  async searchBooks(query, type = 'title') {
    const response = await this.client.post('/books/search', { query, type });
    return response.data;
  }

  // 書籍詳細取得
  async getBookDetail(isbn) {
    const response = await this.client.get(`/books/${isbn}`);
    return response.data;
  }

  // 注文作成
  async createOrder(orderData) {
    const response = await this.client.post('/orders', orderData);
    return response.data;
  }

  // 注文履歴取得
  async getOrders() {
    const response = await this.client.get('/orders');
    return response.data;
  }

  // 注文詳細取得
  async getOrderDetail(orderId) {
    const response = await this.client.get(`/orders/${orderId}`);
    return response.data;
  }

  // 管理者ログイン
  async adminLogin(username, password) {
    const response = await this.client.post('/admin/login', { username, password });
    if (response.data.token) {
      localStorage.setItem('admin_token', response.data.token);
    }
    return response.data;
  }

  // 管理者：全注文取得
  async adminGetOrders() {
    const response = await this.client.get('/admin/orders');
    return response.data;
  }

  // 管理者：顧客一覧取得
  async adminGetCustomers() {
    const response = await this.client.get('/admin/customers');
    return response.data;
  }

  // 管理者：顧客別注文履歴
  async adminGetCustomerOrders(customerId) {
    const response = await this.client.get(`/admin/customer/${customerId}/orders`);
    return response.data;
  }

  // CSV出力
  adminExportCSV() {
    const token = localStorage.getItem('admin_token');
    window.open(`${API_BASE_URL}/admin/export/csv?token=${token}`, '_blank');
  }

  // Excel出力
  adminExportExcel() {
    const token = localStorage.getItem('admin_token');
    window.open(`${API_BASE_URL}/admin/export/excel?token=${token}`, '_blank');
  }

  // ログアウト
  logout() {
    localStorage.removeItem('admin_token');
  }

  // 認証チェック
  isAuthenticated() {
    return !!localStorage.getItem('admin_token');
  }
}

export default new BookOrderAPI();