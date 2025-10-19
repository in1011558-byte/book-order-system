import { useState, useEffect } from 'react';
import './App.css';

// 新しいバックエンドAPIのURL
const API_BASE_URL = 'https://5000-ibki2zpuqo41qwx8z7tsl-5185f4aa.sandbox.novita.ai/api';

// 選書サイト用API関数群
const API = {
  // 認証関連
  async register(userData) {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return response.json();
  },

  async login(credentials) {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return response.json();
  },

  // 書籍検索
  async searchBooks(query, filters = {}) {
    const response = await fetch(`${API_BASE_URL}/books/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, filters }),
    });
    return response.json();
  },

  async getSearchFilters() {
    const response = await fetch(`${API_BASE_URL}/books/filters`);
    return response.json();
  },

  // 選書リスト管理
  async getSelectionLists(token) {
    const response = await fetch(`${API_BASE_URL}/selection-lists`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  async createSelectionList(token, listData) {
    const response = await fetch(`${API_BASE_URL}/selection-lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(listData),
    });
    return response.json();
  },

  async getSelectionList(token, listId) {
    const response = await fetch(`${API_BASE_URL}/selection-lists/${listId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  async updateSelectionList(token, listId, listData) {
    const response = await fetch(`${API_BASE_URL}/selection-lists/${listId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(listData),
    });
    return response.json();
  },

  async deleteSelectionList(token, listId) {
    const response = await fetch(`${API_BASE_URL}/selection-lists/${listId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  async addBookToList(token, listId, bookData) {
    const response = await fetch(`${API_BASE_URL}/selection-lists/${listId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(bookData),
    });
    return response.json();
  },

  async updateBookInList(token, listId, itemId, quantity) {
    const response = await fetch(`${API_BASE_URL}/selection-lists/${listId}/items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ quantity }),
    });
    return response.json();
  },

  async removeBookFromList(token, listId, itemId) {
    const response = await fetch(`${API_BASE_URL}/selection-lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  // 注文データ出力
  async getOrderData(token, listId) {
    const response = await fetch(`${API_BASE_URL}/selection-lists/${listId}/export/order-data`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  async exportCSV(token, listId) {
    const response = await fetch(`${API_BASE_URL}/selection-lists/${listId}/export/csv`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.blob();
  },

  async exportPDF(token, listId) {
    const response = await fetch(`${API_BASE_URL}/selection-lists/${listId}/export/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.blob();
  },
};

function App() {
  // 状態管理
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchFilters, setSearchFilters] = useState({});
  const [availableFilters, setAvailableFilters] = useState({ target_audiences: [], genres: [] });
  const [selectionLists, setSelectionLists] = useState([]);
  const [currentList, setCurrentList] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ログイン・登録用状態
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '', email: '', password: '', full_name: '', organization: ''
  });

  // 初期化
  useEffect(() => {
    loadSearchFilters();
    if (token) {
      loadUserData();
    }
  }, [token]);

  const loadSearchFilters = async () => {
    try {
      const filters = await API.getSearchFilters();
      setAvailableFilters(filters);
    } catch (error) {
      console.error('フィルタ読み込みエラー:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const lists = await API.getSelectionLists(token);
      setSelectionLists(lists.lists || []);
    } catch (error) {
      console.error('ユーザーデータ読み込みエラー:', error);
      handleLogout();
    }
  };

  // ユーザー認証機能
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await API.login(loginForm);
      if (result.token) {
        setToken(result.token);
        setUser(result.user);
        localStorage.setItem('token', result.token);
        setSuccessMessage('ログインしました！');
        setCurrentPage('lists');
        setLoginForm({ username: '', password: '' });
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
        localStorage.setItem('token', result.token);
        setSuccessMessage('アカウントが作成されました！');
        setCurrentPage('lists');
        setRegisterForm({
          username: '', email: '', password: '', full_name: '', organization: ''
        });
      } else {
        setErrorMessage(result.error || '登録に失敗しました');
      }
    } catch (error) {
      setErrorMessage('登録エラー: ' + error.message);
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setSelectionLists([]);
    setCurrentList(null);
    localStorage.removeItem('token');
    setCurrentPage('home');
    setSuccessMessage('ログアウトしました');
  };

  // 書籍検索機能
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await API.searchBooks(searchQuery, searchFilters);
      setSearchResults(result.books || []);
    } catch (error) {
      setErrorMessage('検索エラー: ' + error.message);
      setSearchResults([]);
    }
    setIsLoading(false);
  };

  // 選書リスト管理
  const createNewList = async (name, description = '') => {
    if (!token) return;

    setIsLoading(true);
    try {
      const result = await API.createSelectionList(token, { name, description });
      if (result.list) {
        await loadUserData();
        setSuccessMessage('選書リストを作成しました');
      } else {
        setErrorMessage(result.error || 'リスト作成に失敗しました');
      }
    } catch (error) {
      setErrorMessage('リスト作成エラー: ' + error.message);
    }
    setIsLoading(false);
  };

  const loadList = async (listId) => {
    if (!token) return;

    setIsLoading(true);
    try {
      const result = await API.getSelectionList(token, listId);
      setCurrentList(result.list);
      setCurrentPage('list-detail');
    } catch (error) {
      setErrorMessage('リスト読み込みエラー: ' + error.message);
    }
    setIsLoading(false);
  };

  const addBookToCurrentList = async (book) => {
    if (!currentList || !token) return;

    setIsLoading(true);
    try {
      const result = await API.addBookToList(token, currentList.id, {
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        price: book.price,
        thumbnail: book.thumbnail,
        quantity: 1
      });
      if (result.item) {
        await loadList(currentList.id);
        setSuccessMessage('書籍をリストに追加しました');
      } else {
        setErrorMessage(result.error || '書籍追加に失敗しました');
      }
    } catch (error) {
      setErrorMessage('書籍追加エラー: ' + error.message);
    }
    setIsLoading(false);
  };

  const updateBookQuantity = async (itemId, quantity) => {
    if (!currentList || !token || quantity < 1) return;

    try {
      await API.updateBookInList(token, currentList.id, itemId, quantity);
      await loadList(currentList.id);
      setSuccessMessage('数量を更新しました');
    } catch (error) {
      setErrorMessage('数量更新エラー: ' + error.message);
    }
  };

  const removeBookFromCurrentList = async (itemId) => {
    if (!currentList || !token) return;

    try {
      await API.removeBookFromList(token, currentList.id, itemId);
      await loadList(currentList.id);
      setSuccessMessage('書籍をリストから削除しました');
    } catch (error) {
      setErrorMessage('書籍削除エラー: ' + error.message);
    }
  };

  // ファイル出力機能
  const exportListAsCSV = async () => {
    if (!currentList || !token) return;

    try {
      const blob = await API.exportCSV(token, currentList.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selection_list_${currentList.id}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccessMessage('CSVファイルをダウンロードしました');
    } catch (error) {
      setErrorMessage('CSV出力エラー: ' + error.message);
    }
  };

  const exportListAsPDF = async () => {
    if (!currentList || !token) return;

    try {
      const blob = await API.exportPDF(token, currentList.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order_${currentList.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccessMessage('PDFファイルをダウンロードしました');
    } catch (error) {
      setErrorMessage('PDF出力エラー: ' + error.message);
    }
  };

  // メッセージ自動削除
  useEffect(() => {
    if (errorMessage || successMessage) {
      const timer = setTimeout(() => {
        setErrorMessage('');
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, successMessage]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ナビゲーションヘッダー */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-indigo-600 cursor-pointer" onClick={() => setCurrentPage('home')}>
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
                    onClick={() => { setCurrentPage('lists'); loadUserData(); }}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      currentPage === 'lists' || currentPage === 'list-detail' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📋 選書リスト
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {token ? (
                <>
                  <span className="text-gray-600">こんにちは、{user?.full_name || user?.username}さん</span>
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

      {/* メッセージ表示 */}
      {(errorMessage || successMessage) && (
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
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentPage === 'home' && (
          <div className="text-center">
            <div className="mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">図書選書システム</h2>
              <p className="text-xl text-gray-600 mb-8">学校や図書館向けの図書選定・注文管理システム</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="text-3xl mb-4">🔍</div>
                  <h3 className="text-xl font-bold mb-2">高度検索機能</h3>
                  <p className="text-gray-600">利用対象、ジャンル、価格帯で絞り込める詳細検索</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="text-3xl mb-4">📋</div>
                  <h3 className="text-xl font-bold mb-2">選書リスト管理</h3>
                  <p className="text-gray-600">複数のリストを作成し、数量管理も含めた効率的な選書</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="text-3xl mb-4">📄</div>
                  <h3 className="text-xl font-bold mb-2">注文データ出力</h3>
                  <p className="text-gray-600">書店提出用のCSV・PDF形式での注文データ生成</p>
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

        {currentPage === 'search' && token && (
          <div>
            <h2 className="text-3xl font-bold mb-6">書籍を検索</h2>
            
            {/* 検索フォーム */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="書名、著者名、出版社名で検索"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* フィルタリング */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">利用対象</label>
                  <select
                    value={searchFilters.target_audience || ''}
                    onChange={(e) => setSearchFilters({...searchFilters, target_audience: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">すべて</option>
                    {availableFilters.target_audiences.map(audience => (
                      <option key={audience} value={audience}>{audience}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">ジャンル</label>
                  <select
                    value={searchFilters.genre || ''}
                    onChange={(e) => setSearchFilters({...searchFilters, genre: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">すべて</option>
                    {availableFilters.genres.map(genre => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">価格帯（上限）</label>
                  <input
                    type="number"
                    value={searchFilters.price_max || ''}
                    onChange={(e) => setSearchFilters({...searchFilters, price_max: e.target.value})}
                    placeholder="例: 1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={isLoading || !searchQuery.trim()}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 font-medium"
              >
                {isLoading ? '検索中...' : '🔍 検索'}
              </button>
            </div>

            {/* 検索結果 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((book, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
                  {book.thumbnail && (
                    <img src={book.thumbnail} alt={book.title} className="w-full h-64 object-cover" />
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-2 line-clamp-2">{book.title}</h3>
                    <p className="text-gray-600 text-sm mb-1">著者: {book.author || '不明'}</p>
                    <p className="text-gray-600 text-sm mb-1">出版社: {book.publisher || '不明'}</p>
                    <p className="text-gray-500 text-xs mb-1">ISBN: {book.isbn || 'なし'}</p>
                    {book.price && <p className="text-gray-600 text-sm mb-3">価格: ¥{book.price.toLocaleString()}</p>}
                    
                    {currentList && (
                      <button
                        onClick={() => addBookToCurrentList(book)}
                        disabled={isLoading}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
                      >
                        📋 リストに追加
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {searchResults.length === 0 && searchQuery && !isLoading && (
              <div className="text-center py-8 text-gray-500">
                検索結果が見つかりませんでした。
              </div>
            )}
          </div>
        )}

        {currentPage === 'lists' && token && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">選書リスト</h2>
              <button
                onClick={() => {
                  const name = prompt('新しいリスト名を入力してください:');
                  if (name) createNewList(name);
                }}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                ➕ 新しいリスト
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectionLists.map(list => (
                <div key={list.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition cursor-pointer" 
                     onClick={() => loadList(list.id)}>
                  <h3 className="font-bold text-xl mb-2">{list.name}</h3>
                  {list.description && <p className="text-gray-600 mb-3">{list.description}</p>}
                  <div className="text-sm text-gray-500">
                    <p>書籍数: {list.items_count}冊</p>
                    <p>総数量: {list.total_quantity}冊</p>
                    <p>更新日: {new Date(list.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectionLists.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-xl mb-4">まだ選書リストがありません</p>
                <button
                  onClick={() => {
                    const name = prompt('新しいリスト名を入力してください:');
                    if (name) createNewList(name);
                  }}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  最初のリストを作成
                </button>
              </div>
            )}
          </div>
        )}

        {currentPage === 'list-detail' && currentList && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <button 
                  onClick={() => setCurrentPage('lists')} 
                  className="text-indigo-600 hover:underline mb-2"
                >
                  ← リスト一覧に戻る
                </button>
                <h2 className="text-3xl font-bold">{currentList.name}</h2>
                {currentList.description && <p className="text-gray-600 mt-2">{currentList.description}</p>}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage('search')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  📖 書籍を追加
                </button>
                <button
                  onClick={exportListAsCSV}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  📄 CSV出力
                </button>
                <button
                  onClick={exportListAsPDF}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  📄 PDF出力
                </button>
              </div>
            </div>

            {/* リスト統計 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600">{currentList.items_count}</div>
                <div className="text-gray-600">書籍数</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{currentList.total_quantity}</div>
                <div className="text-gray-600">総数量</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">¥{currentList.total_amount.toLocaleString()}</div>
                <div className="text-gray-600">合計金額</div>
              </div>
            </div>

            {/* 書籍リスト */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {currentList.items.length > 0 ? (
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
                    {currentList.items.map(item => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {item.thumbnail && (
                              <img src={item.thumbnail} alt={item.title} className="w-12 h-16 object-cover mr-3" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.title}</div>
                              <div className="text-sm text-gray-500">{item.isbn}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.author || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.publisher || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.price ? `¥${item.price.toLocaleString()}` : '未定'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateBookQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                            >
                              -
                            </button>
                            <span className="px-3 py-1 bg-gray-100 rounded">{item.quantity}</span>
                            <button
                              onClick={() => updateBookQuantity(item.id, item.quantity + 1)}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ¥{item.subtotal.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => removeBookFromCurrentList(item.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">📚</div>
                  <p className="text-xl mb-4">このリストにはまだ書籍がありません</p>
                  <button
                    onClick={() => setCurrentPage('search')}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    書籍を検索して追加
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!token && (currentPage === 'search' || currentPage === 'lists' || currentPage === 'list-detail') && (
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

      {/* フッター */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="mb-2">📚 図書選書システム</p>
          <p className="text-gray-400 text-sm">学校・図書館向け図書選定・注文管理システム</p>
        </div>
      </footer>
    </div>
  );
}

export default App;