from flask import Flask, jsonify, request

app = Flask(__name__)

# --- CORSヘッダーを手動で設定する最もシンプルな方法 ---
@app.after_request
def after_request(response):
    # どのオリジンからでもアクセスを許可する
    response.headers.add('Access-Control-Allow-Origin', '*')
    # 許可するヘッダー
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    # 許可するメソッド
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# --- ヘルスチェック用ルート ---
@app.route('/')
def index():
    return jsonify({"message": "Verification server is running."})

# --- 検証対象のルート ---
# OPTIONSリクエストを明示的に許可し、200 OKを返す
@app.route('/api/books/search', methods=['POST', 'OPTIONS'])
def search_books_api():
    # プリフライトリクエスト(OPTIONS)には、ヘッダーを付与した上で200 OKを返す
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    # POSTリクエストには、固定のダミーデータを返す
    if request.method == 'POST':
        # リクエストボディの内容をログに出力（デバッグ用）
        try:
            data = request.get_json()
            print(f"Received data: {data}")
        except Exception as e:
            print(f"Could not parse JSON: {e}")

        # 固定のレスポンス
        dummy_books = {
            "books": [
                {
                    "isbn": "978-4-297-10822-6",
                    "title": "【検証用】独習Python",
                    "author": "掌田 津耶乃",
                    "publisher": "翔泳社",
                    "thumbnail": "https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/8226/9784297108226.jpg"
                }
            ]
        }
        return jsonify(dummy_books ), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
