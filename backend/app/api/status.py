from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.services.db_status_service import get_database_statuses

router = APIRouter()

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Status dos Bancos</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 24px;
    }}
    h1 {{
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }}
    th, td {{
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.95rem;
      text-align: left;
    }}
    th {{
      background: #f1f5f9;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      color: #475569;
    }}
    tr:last-child td {{
      border-bottom: 0;
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-weight: 600;
      font-size: 0.8rem;
    }}
    .online {{
      background: #d1fae5;
      color: #065f46;
    }}
    .offline {{
      background: #fee2e2;
      color: #991b1b;
    }}
    .active {{
      background: #e0f2fe;
      color: #075985;
      font-size: 0.75rem;
      text-transform: uppercase;
      margin-left: 0.5rem;
    }}
    footer {{
      margin-top: 1.5rem;
      font-size: 0.85rem;
      color: #475569;
    }}
  </style>
</head>
<body>
  <h1>Status dos Bancos de Dados</h1>
  <table>
    <thead>
      <tr>
        <th>Origem</th>
        <th>URL</th>
        <th>Latência</th>
        <th>Detalhes</th>
      </tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
  </table>
  <footer>Atualizado em tempo real pelo backend FastAPI.</footer>
</body>
</html>
"""


def _build_row(entry: dict) -> str:
  badge = f'<span class="badge {entry["status"]}">{entry["status"].title()}</span>'
  active = '<span class="badge active">Em uso</span>' if entry["is_active"] else ""
  latency = f'{entry["latency_ms"]} ms' if entry["latency_ms"] is not None else "—"
  return f"""
    <tr>
      <td>{badge}{active}</td>
      <td><code>{entry["url"]}</code></td>
      <td>{latency}</td>
      <td>{entry["detail"]}</td>
    </tr>
  """


@router.get("/db", response_class=HTMLResponse)
def database_status_page():
  statuses = get_database_statuses()
  rows = "\n".join(_build_row(item) for item in statuses)
  return HTML_TEMPLATE.format(rows=rows)
