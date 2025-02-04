from flask import Flask, jsonify, render_template
import os

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html', api_key=os.getenv('API_KEY'))

@app.route('/yuboto')
def yuboto():
    return render_template('yuboto.html', api_key=os.getenv('API_KEY'))

@app.route('/cloudcontrol')
def cloudcontrol():
    return render_template('cloudcontrol.html', api_key=os.getenv('API_KEY'))

@app.route('/inspiro')
def inspiro():
    return render_template('inspiro.html', api_key=os.getenv('API_KEY'))

@app.route('/assistant-config/<assistant_name>')
def assistant_config(assistant_name):
    assistants = {
        'simplytalk': os.getenv('ASSISTANT_ID'),
        'yuboto': '500dbf7d-09e7-47c1-bbe5-13639ed8eddb',
        'inspiro': '2a4ee5de-9a82-45cb-af87-6c66563a8513',
        'cloudcontrol': 'f03de106-ab15-4e07-81e2-ab21d3d5bdfa'
    }
    return jsonify({
        'assistantId': assistants.get(assistant_name)
    })

if __name__ == '__main__':
       port = int(os.environ.get('PORT', 8080))
       app.run(host='0.0.0.0', port=port, debug=False)