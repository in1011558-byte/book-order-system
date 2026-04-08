import { useState, useEffect } from 'react';
import './App.css';
import API from './services/api';

function App() {
  // State management
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  
  // Forms
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '', email: '', password: '', full_name: '', organization: ''
  });
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Wishlist & Cart
  const [wishlist, setWishlist] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [availableDates, setAvailableDates] = useState([]);
  
  // Rankings
  const [popularBooks, setPopularBooks] = useState([]);
  const [selectionRankings, setSelectionRankings] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('児童書'); // Default genre
  const [genreBooks, setGenreBooks] = useState({});
  
  // Selection limit warning
  const [selectionLimit, setSelectionLimit] = useState(2);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  
  // Messages
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Load user on mount
  useEffect(() => {
    const currentUser = API.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setToken(localStorage.getItem('authToken'));
      loadUserData();
    }
    loadPopularBooks();
    loadSelectionRankings();
    loadGenreBooks('児童書'); // Load default genre
  }, []);

  // Load popular books
  const loadPopularBooks = async () => {
    const queries = ['鬼滅の刃', 'ハリーポッター', '推しの子', '呪術廻戦', '東京卍リベンジャーズ'];
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    try {
      const result = await API.searchBooks(randomQuery);
      setPopularBooks((result.books || []).slice(0, 10));
    } catch (error) {
      console.error('人気書籍読み込みエラー:', error);
    }
  };

  // Load genre-specific books
  const loadGenreBooks = async (genre) => {
    if (genreBooks[genre]) {
      return; // Already loaded
    }
    
    const genreQueries = {
      '児童書': '児童書',
      'マンガ': 'マンガ',
      '小説': '小説',
      'ビジネス書': 'ビジネス書',
      '絵本': '絵本',
      '実用書': '実用書'
    };
    
    try {
      const result = await API.searchBooks(genreQueries[genre] || genre);
      setGenreBooks(prev => ({
        ...prev,
        [genre]: (result.books || []).slice(0, 10)
      }));
    } catch (error) {
      console.error(`${genre}読み込みエラー:`, error);
    }
  };

  // Load selection rankings from order history
  const loadSelectionRankings = () => {
    const bookCounts = {};
    
    // Scan all orders
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('orders_')) {
        const orders = JSON.parse(localStorage.getItem(key) || '[]');
        orders.forEach(order => {
          order.items.forEach(item => {
            const isbn = item.isbn;
            if (!bookCounts[isbn]) {
              bookCounts[isbn] = { ...item, count: 0 };
            }
            bookCounts[isbn].count += item.quantity || 1;
          });
        });
      }
    }
    
    // Sort by count
    const rankings = Object.values(bookCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    setSelectionRankings(rankings);
  };

  // Load wishlist and cart
  const loadUserData = () => {
    setWishlist(API.getWishlist());
    setCart(API.getCart(selectedDate));
    const dates = API.getAllCartDates();
    setAvailableDates(dates);
  };

  // Load cart when selectedDate changes
  useEffect(() => {
    if (token) {
      setCart(API.getCart(selectedDate));
    }
  }, [selectedDate, token]);

  // Check selection limit - warn when same book has 2+ quantity
  useEffect(() => {
    const hasOverLimit = cart.some(item => (item.quantity || 1) >= 2);
    setShowLimitWarning(hasOverLimit);
  }, [cart]);

  // Authentication handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await API.login(loginForm);
      if (result.token) {
        setToken(result.token);
        setUser(result.user);
        setSuccessMessage('ログインしました！');
        setCurrentPage('search');
        setLoginForm({ username: '', password: '' });
        loadUserData();
      } else {
        setErrorMessage(result.error || 'ログインに失敗しました');
      }
    } catch (error) {
      setErrorMessage('ログインエラー: ' + error.message);
    }
    setIsLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await API.register(registerForm);
      if (result.token) {
        setToken(result.token);
        setUser(result.user);
        setSuccessMessage('アカウントが作成されました！');
        setCurrentPage('search');
        setRegisterForm({
          username: '', email: '', password: '', full_name: '', organization: ''
        });
        loadUserData();
      } else {
        setErrorMessage(result.error || '登録に失敗しました');
      }
    } catch (error) {
      setErrorMessage('登録エラー: ' + error.message);
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    API.logout();
    setToken(null);
    setUser(null);
    setWishlist([]);
    setCart([]);
    setCurrentPage('home');
    setSuccessMessage('ログアウトしました');
  };

  // Search handler
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setErrorMessage('検索キーワードを入力してください');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSearchResults([]);

    try {
      const result = await API.searchBooks(searchQuery);
      setSearchResults(result.books || []);
      if (!result.books || result.books.length === 0) {
        setErrorMessage('検索結果が見つかりませんでした');
      } else {
        setSuccessMessage(`${result.books.length}件の書籍が見つかりました`);
      }
    } catch (error) {
      setErrorMessage('検索エラー: ' + error.message);
      setSearchResults([]);
    }
    setIsLoading(false);
  };

  // Admin handlers
  const handleAdminLogin = () => {
    const adminPassword = prompt('管理者パスワードを入力してください:');
    if (adminPassword === 'ADMIN123') {
      setIsAdmin(true);
      loadAllUsersData();
      setSuccessMessage('管理者としてログインしました');
      setCurrentPage('admin');
    } else {
      setErrorMessage('管理者パスワードが正しくありません');
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAllUsers([]);
    setAllOrders([]);
    setSelectedUser(null);
    setCurrentPage('home');
    setSuccessMessage('管理者からログアウトしました');
  };

  const loadAllUsersData = () => {
    const usersMap = new Map();
    const orders = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      if (key && key.startsWith('orders_')) {
        const token = key.replace('orders_', '');
        const orderHistory = JSON.parse(localStorage.getItem(key) || '[]');
        const userData = JSON.parse(localStorage.getItem(`user_${token}`) || '{}');
        
        orderHistory.forEach(order => {
          orders.push({
            token,
            user: userData,
            items: order.items,
            total: order.total,
            quantity: order.quantity,
            date: new Date(order.date).toLocaleDateString('ja-JP'),
            id: order.id
          });
          
          if (usersMap.has(token)) {
            const userStats = usersMap.get(token);
            userStats.orderCount += 1;
            userStats.totalAmount += order.total;
          } else {
            usersMap.set(token, {
              token,
              ...userData,
              orderCount: 1,
              totalAmount: order.total
            });
          }
        });
      }
      
      if (key && key.startsWith('cart_')) {
        const token = key.replace('cart_', '');
        const cartData = JSON.parse(localStorage.getItem(key) || '[]');
        const userData = JSON.parse(localStorage.getItem(`user_${token}`) || '{}');
        
        if (cartData.length > 0) {
          const orderTotal = cartData.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
          const orderQuantity = cartData.reduce((sum, item) => sum + (item.quantity || 1), 0);
          
          orders.push({
            token,
            user: userData,
            items: cartData,
            total: orderTotal,
            quantity: orderQuantity,
            date: '未確定',
            id: 'cart'
          });
          
          if (usersMap.has(token)) {
            const userStats = usersMap.get(token);
            userStats.orderCount += 1;
            userStats.totalAmount += orderTotal;
          } else {
            usersMap.set(token, {
              token,
              ...userData,
              orderCount: 1,
              totalAmount: orderTotal
            });
          }
        }
      }
    }
    
    setAllUsers(Array.from(usersMap.values()));
    setAllOrders(orders);
  };

  const handleExportAllOrders = () => {
    if (allOrders.length === 0) {
      setErrorMessage('エクスポートする注文がありません');
      return;
    }

    const BOM = '\uFEFF';
    let csvContent = BOM + '注文者,メール,所属,書籍名,著者,出版社,ISBN,価格,冊数,小計\n';
    
    allOrders.forEach(order => {
      order.items.forEach(item => {
        const row = [
          order.user.full_name || order.user.username || '不明',
          order.user.email || '',
          order.user.organization || '',
          item.title || '',
          item.author || '',
          item.publisher || '',
          item.isbn || '',
          item.price || 0,
          item.quantity || 1,
          (item.price || 0) * (item.quantity || 1)
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        
        csvContent += row + '\n';
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `全注文データ_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`;
    link.click();
    
    setSuccessMessage('全注文データをエクスポートしました');
  };

  // Wishlist handlers
  const handleAddToWishlist = (book) => {
    const result = API.addToWishlist(book);
    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setSuccessMessage('ウィッシュリストに追加しました');
      setWishlist(API.getWishlist());
    }
  };

  const handleRemoveFromWishlist = (isbn) => {
    if (window.confirm('この書籍をウィッシュリストから削除しますか？')) {
      API.removeFromWishlist(isbn);
      setSuccessMessage('ウィッシュリストから削除しました');
      setWishlist(API.getWishlist());
    }
  };

  const handleMoveToCart = (book) => {
    API.addToCart(book, 1);
    setSuccessMessage(`${book.title} をカートに追加しました`);
    setCart(API.getCart());
  };

  // Cart handlers
  const handleAddToCart = (book, quantity = 1) => {
    API.addToCart(book, selectedDate);
    setSuccessMessage('カートに追加しました');
    setCart(API.getCart(selectedDate));
    loadUserData(); // Refresh available dates
  };

  const handleRemoveFromCart = (isbn) => {
    API.removeFromCart(isbn, selectedDate);
    setSuccessMessage('カートから削除しました');
    setCart(API.getCart(selectedDate));
  };

  const handleUpdateQuantity = (isbn, quantity) => {
    if (quantity < 1) {
      handleRemoveFromCart(isbn);
    } else {
      API.updateCartQuantity(isbn, quantity, selectedDate);
      setCart(API.getCart(selectedDate));
    }
  };

  const handleClearCart = () => {
    if (window.confirm(`${selectedDate}のカートを空にしますか？`)) {
      API.clearCart(selectedDate);
      setSuccessMessage('カートを空にしました');
      setCart([]);
      loadUserData(); // Refresh available dates
    }
  };

  // Export handler
  const handleExportCSV = () => {
    if (cart.length === 0) {
      setErrorMessage('カートが空です');
      return;
    }

    try {
      const blob = API.exportToCSV(cart, user);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccessMessage('CSVファイルをダウンロードしました');
    } catch (error) {
      setErrorMessage('CSV出力エラー: ' + error.message);
    }
  };

  // Auto-clear messages
  useEffect(() => {
    if (errorMessage || successMessage) {
      const timer = setTimeout(() => {
        setErrorMessage('');
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, successMessage]);

  // Calculate cart total
  const cartTotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const cartQuantity = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 
                className="text-2xl font-bold text-indigo-600 cursor-pointer" 
                onClick={() => setCurrentPage('home')}
              >
                📚 選書サイト
              </h1>
              
              {token && (
                <div className="flex space-x-4">
                  <button
                    onClick={() => setCurrentPage('search')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      currentPage === 'search' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📖 書籍検索
                  </button>
                  <button
                    onClick={() => setCurrentPage('wishlist')}
                    className={`px-4 py-2 rounded-lg font-medium transition relative ${
                      currentPage === 'wishlist' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    ♡ ウィッシュリスト
                    {wishlist.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {wishlist.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setCurrentPage('cart')}
                    className={`px-4 py-2 rounded-lg font-medium transition relative ${
                      currentPage === 'cart' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    🛒 カート
                    {cartQuantity > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {cartQuantity}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {isAdmin && (
                <button
                  onClick={() => setCurrentPage('admin')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    currentPage === 'admin' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  👤 管理画面
                </button>
              )}
              {token ? (
                <>
                  <span className="text-gray-600">こんにちは、{user?.full_name || user?.username}さん</span>
                  {isAdmin && (
                    <button
                      onClick={handleAdminLogout}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      管理者ログアウト
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleAdminLogin}
                    className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                  >
                    🔐 管理者
                  </button>
                  <button
                    onClick={() => setCurrentPage('login')}
                    className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  >
                    ログイン
                  </button>
                  <button
                    onClick={() => setCurrentPage('register')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    新規登録
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Messages */}
      {(errorMessage || successMessage || showLimitWarning) && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">エラー</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">成功</p>
              <p className="text-sm">{successMessage}</p>
            </div>
          )}
          {showLimitWarning && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">⚠️ 警告</p>
              <p className="text-sm">
                選書数が{selectionLimit}冊を超えています（現在: {cartQuantity}冊）
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Home Page */}
        {currentPage === 'home' && (
          <div className="text-center">
            {/* Genre-based Ranking - Moved to top */}
            <div className="mb-16">
              <h3 className="text-3xl font-bold text-gray-900 mb-6">📚 ジャンル別ランキング</h3>
              
              {/* Genre Navigation */}
              <div className="flex flex-wrap gap-2 mb-8">
                {['児童書', 'マンガ', '小説', 'ビジネス書', '絵本', '実用書'].map(genre => (
                  <button
                    key={genre}
                    onClick={() => {
                      setSelectedGenre(genre);
                      loadGenreBooks(genre);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      selectedGenre === genre
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>

              {/* Genre Books Display */}
              {genreBooks[selectedGenre] && genreBooks[selectedGenre].length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {genreBooks[selectedGenre].map((book, index) => (
                    <div key={book.isbn} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition">
                      <div className="relative">
                        <div className="absolute -top-2 -left-2 bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        {book.thumbnail && (
                          <img 
                            src={book.thumbnail} 
                            alt={book.title}
                            className="w-full h-36 object-cover rounded mb-3"
                          />
                        )}
                      </div>
                      <h4 className="font-bold text-sm mb-1 line-clamp-2">{book.title}</h4>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-1">{book.author}</p>
                      <p className="text-sm font-bold text-indigo-600">¥{(book.price || 0).toLocaleString()}</p>
                      {token && (
                        <div className="mt-3 flex gap-1">
                          <button
                            onClick={() => handleAddToWishlist(book)}
                            className="flex-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            ♡
                          </button>
                          <button
                            onClick={() => handleAddToCart(book)}
                            className="flex-1 text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            🛒
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Loading state */}
              {!genreBooks[selectedGenre] && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📖</div>
                  <p className="text-gray-500">読み込み中...</p>
                </div>
              )}
            </div>

            {/* Selection Rankings */}
            {selectionRankings.length > 0 && (
              <div className="mb-16">
                <h3 className="text-3xl font-bold text-gray-900 mb-8">🏆 選書ランキング</h3>
                <p className="text-gray-600 mb-6">皆さんに選ばれた人気の書籍</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {selectionRankings.map((book, index) => (
                    <div key={book.isbn} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition">
                      <div className="relative">
                        <div className="absolute -top-2 -left-2 bg-yellow-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        {book.thumbnail && (
                          <img 
                            src={book.thumbnail} 
                            alt={book.title}
                            className="w-full h-36 object-cover rounded mb-3"
                          />
                        )}
                      </div>
                      <h4 className="font-bold text-sm mb-1 line-clamp-2">{book.title}</h4>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-1">{book.author}</p>
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-bold text-indigo-600">¥{(book.price || 0).toLocaleString()}</p>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          {book.count}冊
                        </span>
                      </div>
                      {token && (
                        <div className="mt-3 flex gap-1">
                          <button
                            onClick={() => handleAddToWishlist(book)}
                            className="flex-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            ♡
                          </button>
                          <button
                            onClick={() => handleAddToCart(book)}
                            className="flex-1 text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            🛒
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">図書選書システム</h2>
              <p className="text-xl text-gray-600 mb-8">学校や図書館向けの図書選定・注文管理システム</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="text-3xl mb-4">🔍</div>
                  <h3 className="text-xl font-bold mb-2">包括的な書籍検索</h3>
                  <p className="text-gray-600">Google Books APIを使用した詳細検索で、全ての関連書籍を表示</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="text-3xl mb-4">📋</div>
                  <h3 className="text-xl font-bold mb-2">ウィッシュリスト管理</h3>
                  <p className="text-gray-600">気になる書籍をリストに保存し、後でカートに追加</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="text-3xl mb-4">🛒</div>
                  <h3 className="text-xl font-bold mb-2">カート＆注文</h3>
                  <p className="text-gray-600">数量管理と選書制限警告機能付きのカートシステム</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="text-3xl mb-4">📄</div>
                  <h3 className="text-xl font-bold mb-2">CSV出力</h3>
                  <p className="text-gray-600">書店提出用のCSV形式で注文データを出力</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="text-3xl mb-4">⚠️</div>
                  <h3 className="text-xl font-bold mb-2">選書制限警告</h3>
                  <p className="text-gray-600">設定した冊数を超えた場合に自動で警告を表示</p>
                </div>
              </div>

              {!token && (
                <div className="mt-12">
                  <button
                    onClick={() => setCurrentPage('register')}
                    className="px-8 py-4 bg-indigo-600 text-white text-lg font-medium rounded-lg hover:bg-indigo-700 transition mr-4"
                  >
                    今すぐ始める
                  </button>
                  <button
                    onClick={() => setCurrentPage('login')}
                    className="px-8 py-4 bg-white text-indigo-600 text-lg font-medium rounded-lg border border-indigo-600 hover:bg-indigo-50 transition"
                  >
                    ログイン
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Login Page */}
        {currentPage === 'login' && (
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-center mb-6">ログイン</h2>
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  ユーザー名またはメールアドレス
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  パスワード
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {isLoading ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>
            <p className="text-center mt-4 text-gray-600">
              アカウントをお持ちでない場合は{' '}
              <button onClick={() => setCurrentPage('register')} className="text-indigo-600 hover:underline">
                新規登録
              </button>
            </p>
          </div>
        )}

        {/* Register Page */}
        {currentPage === 'register' && (
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-center mb-6">新規登録</h2>
            <form onSubmit={handleRegister}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  ユーザー名 *
                </label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  メールアドレス *
                </label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  パスワード *
                </label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  お名前
                </label>
                <input
                  type="text"
                  value={registerForm.full_name}
                  onChange={(e) => setRegisterForm({...registerForm, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  所属（学校名など）
                </label>
                <input
                  type="text"
                  value={registerForm.organization}
                  onChange={(e) => setRegisterForm({...registerForm, organization: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {isLoading ? '登録中...' : '登録する'}
              </button>
            </form>
            <p className="text-center mt-4 text-gray-600">
              すでにアカウントをお持ちの場合は{' '}
              <button onClick={() => setCurrentPage('login')} className="text-indigo-600 hover:underline">
                ログイン
              </button>
            </p>
          </div>
        )}

        {/* Search Page */}
        {currentPage === 'search' && token && (
          <div>
            <h2 className="text-3xl font-bold mb-6">書籍を検索</h2>
            
            {/* Search Form */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="書名、著者名、出版社名で検索"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading || !searchQuery.trim()}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 font-medium"
                >
                  {isLoading ? '検索中...' : '🔍 検索'}
                </button>
              </div>
              <p className="text-sm text-gray-500">
                💡 ヒント: 「鬼滅の刃」などシリーズ作品を検索すると、全巻が表示されます
              </p>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map((book, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
                    {book.thumbnail && (
                      <img src={book.thumbnail} alt={book.title} className="w-full h-48 object-cover" />
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-2 line-clamp-2">{book.title}</h3>
                      <p className="text-gray-600 text-sm mb-1">著者: {book.author || '不明'}</p>
                      <p className="text-gray-600 text-sm mb-1">出版社: {book.publisher || '不明'}</p>
                      <p className="text-gray-500 text-xs mb-1">ISBN: {book.isbn || 'なし'}</p>
                      {book.price > 0 && (
                        <p className="text-gray-600 text-sm mb-3">価格: ¥{book.price.toLocaleString()}</p>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleAddToWishlist(book)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium text-sm"
                        >
                          ♡ リスト
                        </button>
                        <button
                          onClick={() => handleAddToCart(book)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
                        >
                          🛒 カート
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !isLoading && searchQuery && (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">📚</div>
                  <p className="text-xl">検索結果が見つかりませんでした</p>
                </div>
              )
            )}
          </div>
        )}

        {/* Wishlist Page */}
        {currentPage === 'wishlist' && token && (
          <div>
            <h2 className="text-3xl font-bold mb-6">ウィッシュリスト</h2>
            
            {wishlist.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-6xl mb-4">♡</div>
                <p className="text-gray-500 text-lg mb-4">ウィッシュリストは空です</p>
                <button
                  onClick={() => setCurrentPage('search')}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  書籍を検索
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wishlist.map((item, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-48 object-cover" />
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-2 line-clamp-2">{item.title}</h3>
                      <p className="text-gray-600 text-sm mb-1">著者: {item.author || '不明'}</p>
                      <p className="text-gray-500 text-xs mb-3">ISBN: {item.isbn || 'なし'}</p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleRemoveFromWishlist(item.isbn)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium text-sm"
                        >
                          削除
                        </button>
                        <button
                          onClick={() => handleMoveToCart(item)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
                        >
                          🛒 カートへ
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cart Page */}
        {currentPage === 'cart' && token && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">カート</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={cart.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  📄 CSV出力
                </button>
                <button
                  onClick={handleClearCart}
                  disabled={cart.length === 0}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  🗑️ 空にする
                </button>
              </div>
            </div>

            {/* Date Selection */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-4">
                <label className="font-bold text-gray-700">📅 選書日:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                {availableDates.length > 1 && (
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-gray-600">保存済み:</span>
                    {availableDates.slice(0, 5).map(date => (
                      <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`text-sm px-3 py-1 rounded ${
                          date === selectedDate
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {date}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cart Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600">{cart.length}</div>
                <div className="text-gray-600">種類</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{cartQuantity}</div>
                <div className="text-gray-600">総冊数</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">¥{cartTotal.toLocaleString()}</div>
                <div className="text-gray-600">合計金額</div>
              </div>
            </div>

            {/* Selection Limit Settings */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex items-center gap-4">
                <label className="text-gray-700 font-medium">選書制限:</label>
                <input
                  type="number"
                  value={selectionLimit}
                  onChange={(e) => setSelectionLimit(parseInt(e.target.value) || 2)}
                  min="1"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <span className="text-gray-600">冊まで</span>
                {showLimitWarning && (
                  <span className="text-red-600 font-medium">
                    ⚠️ 同じ本を2冊以上選書しています
                  </span>
                )}
              </div>
            </div>

            {/* Cart Items */}
            {cart.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-6xl mb-4">🛒</div>
                <p className="text-gray-500 text-lg mb-4">カートは空です</p>
                <button
                  onClick={() => setCurrentPage('search')}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  書籍を検索
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">書籍</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">著者</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出版社</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">価格</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">小計</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cart.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {item.thumbnail && (
                              <img src={item.thumbnail} alt={item.title} className="w-10 h-12 object-cover mr-3" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900 max-w-xs truncate">{item.title}</div>
                              <div className="text-sm text-gray-500">{item.isbn}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.author || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.publisher || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.price > 0 ? `¥${item.price.toLocaleString()}` : '未定'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleUpdateQuantity(item.isbn, item.quantity - 1)}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              -
                            </button>
                            <span className="px-3 py-1 bg-gray-100 rounded">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.isbn, item.quantity + 1)}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ¥{((item.price || 0) * item.quantity).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleRemoveFromCart(item.isbn)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Protected pages - require login */}
        {!token && (currentPage === 'search' || currentPage === 'wishlist' || currentPage === 'cart') && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-2xl font-bold mb-4">ログインが必要です</h3>
            <p className="text-gray-600 mb-6">この機能を利用するにはログインしてください。</p>
            <button
              onClick={() => setCurrentPage('login')}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition mr-4"
            >
              ログイン
            </button>
            <button
              onClick={() => setCurrentPage('register')}
              className="px-6 py-2 bg-white text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-50 transition"
            >
              新規登録
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="mb-2">📚 図書選書システム</p>
          <p className="text-gray-400 text-sm">学校・図書館向け図書選定・注文管理システム</p>
          <p className="text-gray-500 text-xs mt-4">
            Google Books APIを使用 | デモではなく実際に使用可能なシステムです
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
