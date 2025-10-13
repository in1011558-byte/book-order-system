import { useState, useEffect } from 'react';
import API from './services/api'; // api.jsをインポート

function App() {
  // --- State定義 ---
  const [currentPage, setCurrentPage] = useState('search');
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]); // ★ウィッシュリスト用のStateを追加
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('title');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerOrg, setCustomerOrg] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  // ★顧客IDを仮で設定（本来はログイン機能などで管理）
  const CUSTOMER_ID = 1; 

  // --- useEffect ---
  useEffect(() => {
    // カート情報をローカルストレージから読み込み
    try {
      const savedCart = window.localStorage.getItem('bookCart');
      if (savedCart) setCart(JSON.parse(savedCart));
    } catch (error) { console.error('Failed to load cart:', error); }
    
    // ★ウィッシュリストをAPIから読み込み
    fetchWishlist();
  }, []);

  useEffect(() => {
    // カート情報をローカルストレージに保存
    try {
      window.localStorage.setItem('bookCart', JSON.stringify(cart));
    } catch (error) { console.error('Failed to save cart:', error); }
  }, [cart]);

  // --- API呼び出し関数 ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) { alert('検索キーワードを入力してください'); return; }
    setIsSearching(true);
    setErrorMessage('');
    try {
      const data = await API.searchBooks(searchQuery, searchType);
      setSearchResults(data.books || []);
      if (!data.books || data.books.length === 0) { alert('検索結果が見つかりませんでした'); }
    } catch (error) {
      const errorMsg = 'バックエンドサーバーに接続できません。サーバーが起動しているか、CORSが正しく設定されているか確認してください。';
      setErrorMessage(errorMsg);
      alert(errorMsg);
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // ★ウィッシュリスト取得処理
  const fetchWishlist = async () => {
    try {
      const data = await API.getWishlist(CUSTOMER_ID);
      setWishlist(data || []);
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
    }
  };

  // ★ウィッシュリスト追加処理
  const handleAddToWishlist = async (book) => {
    try {
      await API.addToWishlist(CUSTOMER_ID, book);
      alert('ウィッシュリストに追加しました');
      fetchWishlist(); // リストを再取得して更新
    } catch (error) {
      alert('ウィッシュリストへの追加に失敗しました');
      console.error('Failed to add to wishlist:', error);
    }
  };

  // ★ウィッシュリスト削除処理
  const handleRemoveFromWishlist = async (itemId) => {
    if (window.confirm('この本をウィッシュリストから削除しますか？')) {
      try {
        await API.removeFromWishlist(itemId);
        alert('削除しました');
        fetchWishlist(); // リストを再取得して更新
      } catch (error) {
        alert('削除に失敗しました');
        console.error('Failed to remove from wishlist:', error);
      }
    }
  };

  // --- カート関連の関数 ---
  const addToCart = (book, quantity = 1) => {
    const existing = cart.find(item => item.isbn === book.isbn);
    if (existing) {
      setCart(cart.map(item =>
        item.isbn === book.isbn ? { ...item, quantity: item.quantity + quantity } : item
      ));
    } else {
      setCart([...cart, { ...book, quantity }]);
    }
  };

  const handleMoveToCart = (book) => {
    addToCart(book);
    alert(`${book.title} をカートに追加しました。`);
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
  
  // (他の既存関数は変更なし)
  const clearCart = () => { if (window.confirm('カートを空にしますか？')) { setCart([]); } };
  const handleOrderSubmit = async () => { /* ...変更なし... */ };
  const handleAdminLogin = async () => { /* ...変更なし... */ };
  const handleAdminLogout = () => { /* ...変更なし... */ };
  const loadAdminData = async () => { /* ...変更なし... */ };
  const handleExportCSV = async () => { /* ...変更なし... */ };
  const handleExportExcel = async () => { /* ...変更なし... */ };
  const viewCustomerOrders = async (customerId) => { /* ...変更なし... */ };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">📚 書籍注文システム</h1>
        </div>
      </header>

      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-4 py-3">
            {/* --- ナビゲーション --- */}
            <button onClick={() => setCurrentPage('search')} className={`px-4 py-2 rounded-lg font-medium transition ${currentPage === 'search' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>書籍検索</button>
            
            {/* ★ウィッシュリストへのナビゲーションボタンを追加 */}
            <button onClick={() => setCurrentPage('wishlist')} className={`px-4 py-2 rounded-lg font-medium transition relative ${currentPage === 'wishlist' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              ウィッシュリスト
              {wishlist.length > 0 && <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{wishlist.length}</span>}
            </button>

            <button onClick={() => setCurrentPage('cart')} className={`px-4 py-2 rounded-lg font-medium transition relative ${currentPage === 'cart' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              カート
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>}
            </button>
            <button onClick={() => { if (isAdmin) loadAdminData(); setCurrentPage('admin'); }} className={`px-4 py-2 rounded-lg font-medium transition ${currentPage === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{isAdmin ? '管理画面' : '管理者ログイン'}</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* --- エラーメッセージ表示 (変更なし) --- */}
        {errorMessage && ( <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">...</div> )}

        {/* --- 検索ページ --- */}
        {currentPage === 'search' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">書籍を検索</h2>
            {/* ... 検索フォーム (変更なし) ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((book, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition flex flex-col">
                  {book.thumbnail && <img src={book.thumbnail} alt={book.title} className="w-full h-64 object-cover" />}
                  <div className="p-4 flex flex-col flex-grow">
                    <h3 className="font-bold text-lg mb-2 line-clamp-2 flex-grow">{book.title}</h3>
                    <p className="text-gray-600 text-sm mb-1">著者: {book.author || '不明'}</p>
                    <p className="text-gray-600 text-sm mb-1">出版社: {book.publisher || '不明'}</p>
                    <p className="text-gray-500 text-xs mb-3">ISBN: {book.isbn || 'なし'}</p>
                    <div className="mt-auto grid grid-cols-2 gap-2">
                      {/* ★ウィッシュリスト追加ボタン */}
                      <button onClick={() => handleAddToWishlist(book)} className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium text-sm">
                        ♡ リスト追加
                      </button>
                      <button onClick={() => addToCart(book)} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm">
                        🛒 カート追加
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ★★★ ウィッシュリストページ (ここから新規追加) ★★★ */}
        {currentPage === 'wishlist' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">ウィッシュリスト</h2>
            {wishlist.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500 text-lg">ウィッシュリストは空です</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wishlist.map((item) => (
                  <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition flex flex-col">
                    {item.thumbnail && <img src={item.thumbnail} alt={item.title} className="w-full h-64 object-cover" />}
                    <div className="p-4 flex flex-col flex-grow">
                      <h3 className="font-bold text-lg mb-2 line-clamp-2 flex-grow">{item.title}</h3>
                      <p className="text-gray-600 text-sm mb-1">著者: {item.author || '不明'}</p>
                      <p className="text-gray-500 text-xs mb-3">ISBN: {item.isbn || 'なし'}</p>
                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <button onClick={() => handleRemoveFromWishlist(item.id)} className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium text-sm">
                          削除
                        </button>
                        <button onClick={() => handleMoveToCart(item)} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm">
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

        {/* --- カートページ (変更なし) --- */}
        {currentPage === 'cart' && ( <div>...</div> )}

        {/* --- 管理者ページ (変更なし) --- */}
        {currentPage === 'admin' && ( <div>...</div> )}
      </main>
    </div>
  );
}

export default App;
