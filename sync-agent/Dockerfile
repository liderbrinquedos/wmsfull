FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Sem porta, sem volume: o agente so faz requisicoes de saida.
CMD ["python", "-u", "agent.py"]
