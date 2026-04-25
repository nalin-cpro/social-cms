FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y libglib2.0-0 libgl1 && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt api_requirements.txt
COPY requirements.txt .
RUN pip install --no-cache-dir -r api_requirements.txt -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
