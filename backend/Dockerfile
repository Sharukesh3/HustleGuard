FROM python:3.12.10-slim

WORKDIR /app

# Install system dependencies for YOLO (OpenCV)
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 && rm -rf /var/lib/apt/lists/*

COPY requirements_ml.txt .
RUN pip install --no-cache-dir -r requirements_ml.txt

COPY . .

# Run the ML server (NOT main.py)
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn ml_server:app --host 0.0.0.0 --port ${PORT}"]