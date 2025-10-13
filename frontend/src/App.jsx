import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let authToken = null;

const API = {
  setAuthToken(token) {
    authToken = token;
  },
  
  async searchBooks(query, type = 'title') {
    const response = await fetch(`${API_BASE_URL}/books/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, type })
    });
    return response.json();
  },
  
  async createOrder(orderData) {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });
    return response.json();
  },
  
  async adminLogin(username, password) {
    const response = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    return response.json();
  },
    return response.blob();
  },
};

function App() {
  // ページ管理
  const [currentPage, setCurrentPage] = useState('search');
  
  // カート
  const [cart, setCart] = useState([]);
  
  // 検索
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('title');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 注文
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerOrg, setCustomerOrg] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  
  // 管理者
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // ローカルストレージからカートを読み込み
  useEffect(() => {
    const savedCart = localStorage.getItem('bookCart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  // カートをローカルストレージに保存
  useEffect(() => {
    localStorage.setItem('bookCart', JSON.stringify(cart));
  }, [cart]);

  // ==================== 書籍検索 ====================
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert('検索キーワードを入力してください');
      return;
    }

    setIsSearching(true);
    try {
      const data = await API.searchBooks(searchQuery, searchType);
      setSearchResults(data.books || []);
      if (data.books.length === 0) {
        alert('検索結果が見つかりませんでした');
      }
    } catch (error) {
      alert('検索に失敗しました');
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  // ==================== カート管理 ====================
  
  const addToCart = (book) => {
    const existing = cart.find(item => item.isbn === book.isbn);
    if (existing) {
      setCart(cart.map(item =>
        item.isbn === book.isbn
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
      alert('数量を1つ増やしました');
    } else {
      setCart([...cart, { ...book, quantity: 1 }]);
      alert('カートに追加しました');
    }
  };

  const removeFromCart = (isbn) => {
    setCart(cart.filter(item => item.isbn !== isbn));
  };

  const updateQuantity = (isbn, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(isbn);
    } else {
      setCart(cart.map(item =>
        item.isbn === isbn ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const clearCart = () => {
    if (window.confirm('カートを空にしますか？')) {
      setCart([]);
    }
  };

  // ==================== 注文確定 ====================
  
  const handleOrderSubmit = async () => {
    if (!customerName.trim()) {
      alert('お名前を入力してください');
      return;
    }

    if (cart.length === 0) {
      alert('カートに商品を追加してください');
      return;
    }

    try {
      const orderData = {
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          organization: customerOrg,
        },
        items: cart.map(item => ({
          isbn: item.isbn,
          title: item.title,
          author: item.author,
          publisher: item.publisher,
          quantity: item.quantity,
          thumbnail: item.thumbnail,
        })),
        notes: orderNotes,
      };

      await API.createOrder(orderData);
      alert('注文が完了しました！');
      
      // リセット
      setCart([]);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerOrg('');
      setOrderNotes('');
      setCurrentPage('search');
    } catch (error) {
      alert('注文に失敗しました');
      console.error(error);
    }
  };

  // ==================== 管理者ログイン ====================
  
  const handleAdminLogin = async () => {
    try {
      const data = await API.adminLogin(adminUsername, adminPassword);
      API.setAuthToken(data.token);
      setIsAdmin(true);
      loadAdminData();
      alert('ログインしました');
    } catch (error) {
      alert('ログインに失敗しました');
      console.error(error);
    }
  };

  const handleAdminLogout = () => {
    API.setAuthToken(null);
    setIsAdmin(false);
    setAdminUsername('');
    setAdminPassword('');
    setCurrentPage('search');
  };

  const loadAdminData = async () => {
    try {
      const [ordersData, customersData] = await Promise.all([
        API.adminGetOrders(),
        API.adminGetCustomers(),
      ]);
      setOrders(ordersData.orders || []);
      setCustomers(customersData.customers || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await API.adminExportCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      alert('エクスポートに失敗しました');
      console.error(error);
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await API.adminExportExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
    } catch (error) {
      alert('エクスポートに失敗しました');
      console.error(error);
    }
  };

  const viewCustomerOrders = async (customerId) => {
    try {
      const data = await API.adminGetCustomerOrders(customerId);
      setSelectedCustomer(data);
    } catch (error) {
      alert('データの取得に失敗しました');
      console.error(error);
    }
  };

  // ==================== ページ描画 ====================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-indigo-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">📚 書籍注文システム</h1>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-4 py-3">
            <button
              onClick={() => setCurrentPage('search')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                currentPage === 'search'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              書籍検索
            </button>
            <button
              onClick={() => setCurrentPage('cart')}
              className={`px-4 py-2 rounded-lg font-medium transition relative ${
                currentPage === 'cart'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              カート
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                if (isAdmin) {
                  loadAdminData();
                }
                setCurrentPage('admin');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                currentPage === 'admin'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isAdmin ? '管理画面' : '管理者ログイン'}
            </button>
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 書籍検索ページ */}
        {currentPage === 'search' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">書籍を検索</h2>
            
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="title">書名で検索</option>
                  <option value="isbn">ISBNで検索</option>
                </select>
                
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={searchType === 'title' ? '書名を入力' : 'ISBNを入力'}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 font-medium"
                >
                  {isSearching ? '検索中...' : '🔍 検索'}
                </button>
              </div>
            </div>

            {/* 検索結果 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((book, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
                  {book.thumbnail && (
                    <img
                      src={book.thumbnail}
                      alt={book.title}
                      className="w-full h-64 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-2 line-clamp-2">{book.title}</h3>
                    <p className="text-gray-600 text-sm mb-1">著者: {book.author || '不明'}</p>
                    <p className="text-gray-600 text-sm mb-1">出版社: {book.publisher || '不明'}</p>
                    <p className="text-gray-500 text-xs mb-3">ISBN: {book.isbn || 'なし'}</p>
                    <button
                      onClick={() => addToCart(book)}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                    >
                      🛒 カートに追加
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* カートページ */}
        {currentPage === 'cart' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">カート</h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  カートを空にする
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500 text-lg">カートは空です</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow-md mb-6">
                  {cart.map((item) => (
                    <div key={item.isbn} className="flex gap-4 p-4 border-b last:border-b-0">
                      {item.thumbnail && (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-24 h-32 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold mb-1">{item.title}</h3>
                        <p className="text-gray-600 text-sm mb-1">著者: {item.author}</p>
                        <p className="text-gray-600 text-sm">出版社: {item.publisher}</p>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <button
                          onClick={() => removeFromCart(item.isbn)}
                          className="text-red-500 hover:text-red-700"
                        >
                          削除
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.isbn, item.quantity - 1)}
                            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.isbn, item.quantity + 1)}
                            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-xl font-bold mb-4">注文者情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="お名前 *"
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="メールアドレス"
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="電話番号"
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={customerOrg}
                      onChange={(e) => setCustomerOrg(e.target.value)}
                      placeholder="学校名・塾名"
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="備考（任意）"
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
                  />
                  <button
                    onClick={handleOrderSubmit}
                    className="w-full px-6 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-lg font-bold"
                  >
                    ✓ 注文を確定する
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 管理者ページ */}
        {currentPage === 'admin' && (
          <div>
            {!isAdmin ? (
              <div className="max-w-md mx-auto">
                <h2 className="text-3xl font-bold mb-6 text-center">管理者ログイン</h2>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="ユーザー名"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                    placeholder="パスワード"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAdminLogin}
                    className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                  >
                    ログイン
                  </button>
                  <p className="text-sm text-gray-500 mt-4 text-center">
                    デフォルト: admin / admin123
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold">管理画面</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      CSV出力
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      Excel出力
                    </button>
                    <button
                      onClick={handleAdminLogout}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                    >
                      ログアウト
                    </button>
                  </div>
                </div>

                {selectedCustomer ? (
                  <div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="mb-4 text-indigo-600 hover:underline"
                    >
                      ← 戻る
                    </button>
                    <h3 className="text-2xl font-bold mb-4">
                      {selectedCustomer.customer.name} さんの注文履歴
                    </h3>
                    <div className="space-y-4">
                      {selectedCustomer.orders.map((order) => (
                        <div key={order.id} className="bg-white rounded-lg shadow-md p-6">
                          <div className="flex justify-between mb-4">
                            <div>
                              <p className="font-bold">注文ID: {order.id}</p>
                              <p className="text-gray-600">
                                {new Date(order.order_date).toLocaleString('ja-JP')}
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                              {order.status}
                            </span>
                          </div>
                          <div className="border-t pt-4">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="mb-2">
                                <p className="font-medium">{item.title}</p>
                                <p className="text-sm text-gray-600">
                                  数量: {item.quantity}冊
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 顧客一覧 */}
                    <div>
                      <h3 className="text-xl font-bold mb-4">顧客一覧</h3>
                      <div className="bg-white rounded-lg shadow-md">
                        {customers.map((customer) => (
                          <div
                            key={customer.id}
                            onClick={() => viewCustomerOrders(customer.id)}
                            className="p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                          >
                            <p className="font-bold">{customer.name}</p>
                            <p className="text-sm text-gray-600">{customer.organization}</p>
                            <p className="text-sm text-gray-500">
                              注文回数: {customer.order_count}回
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 最近の注文 */}
                    <div>
                      <h3 className="text-xl font-bold mb-4">最近の注文</h3>
                      <div className="space-y-4">
                        {orders.slice(0, 10).map((order) => (
                          <div key={order.id} className="bg-white rounded-lg shadow-md p-4">
                            <div className="flex justify-between mb-2">
                              <p className="font-bold">{order.customer_name}</p>
                              <span className="text-sm text-gray-500">
                                {new Date(order.order_date).toLocaleDateString('ja-JP')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {order.total_items}冊の注文
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;