FROM python:3.12-slim
WORKDIR /app
COPY monitor/collect.py /app/collect.py
RUN mkdir /data && chown 1000:1000 /data
USER 1000:1000
CMD ["python3", "-u", "collect.py", "--output", "/data/outages.json", "--watch", "--interval", "1800"]
