# UpEnergy Ghana — CX Platform

A full-stack CRM built for the UpEnergy Ghana Customer Experience team. Manages support tickets, field agents, and carbon credit entries for ICS Klik, ICS Singapore, ECD, and EPC product lines.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (single file, no build step) |
| Backend | Node.js + Express |
| Database | PostgreSQL |

---

## Prerequisites

Before you start, make sure you have these installed:

- [Node.js](https://nodejs.org) — LTS version recommended
- [PostgreSQL](https://postgresql.org/download) — version 13 or higher

---

## Project Structure
upenergy-crm/
├── index.html       # Full frontend (open in browser)
├── server.js        # Express API server
├── db.sql           # Database schema — run once to set up tables
├── .env             # Environment variables (create this yourself)
├── package.json
└── node_modules/

---

## Setup

### 1. Clone or copy the project files

Make sure you have all four files in one folder: `index.html`, `server.js`, `db.sql`, and follow the steps below to create `.env`.

### 2. Install dependencies

```bash
cd upenergy-crm
npm install
```

### 3. Create your `.env` file

Create a file called `.env` in the project root and fill in your PostgreSQL credentials:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=upenergy_crm
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
PORT=4000

### 4. Set up the database

You only need to do this once.

**Option A — pgAdmin (visual):**
1. Open pgAdmin → right-click **Databases** → **Create** → **Database** → name it `upenergy_crm`
2. Select `upenergy_crm` → open the **Query Tool** (`Alt+Shift+Q`)
3. Open `db.sql` via the folder icon in the toolbar
4. Press **F5** to run — you should see "Query returned successfully"

**Option B — psql (terminal):**
```bash
# Windows
psql -U postgres -f "C:\path\to\upenergy-crm\db.sql"

# Mac / Linux
psql -U postgres -f /path/to/upenergy-crm/db.sql
```

This creates 4 tables: `tickets`, `ticket_timeline`, `agents`, and `carbon_credits`.

### 5. Start the server

```bash
node server.js
```

You should see:
UpEnergy CRM API running on http://localhost:4000

### 6. Open the app

Double-click `index.html` or drag it into Chrome/Firefox. The frontend talks to the API at `localhost:4000`.

---

## Features

### Tickets
- Log tickets with customer name, phone, region, serial number, product, issue type, source, priority, and assigned agent
- Serial number auto-detects the product (e.g. typing `GZGY...` auto-selects ICS Klik)
- Filter by status (Open, In Progress, Pending, Resolved), product, priority, and keyword search
- Click any ticket row to open a detail panel — update status, log resolution notes, add timeline entries

### Field Agents
- Directory of field agents and verification officers (no CRM login — they report via Google Form, WhatsApp, or phone)
- Shows each agent's open tickets, resolved tickets, and resolution rate
- Add and remove agents from the directory

### Reports
- Live breakdowns of tickets by product, reporting channel, priority, and reporter type
- Summary stats: total tickets, resolved, open/active, resolution rate

### Carbon Credits
- Log carbon credit entries per device with product, serial number, region, and tCO₂e issued
- Mark entries as Verified
- Totals per product displayed at the top

---

## Product Serial Prefixes

| Product | Serial Prefix | Example |
|---------|--------------|---------|
| ICS Klik | `GZGY` | GZGY-00421 |
| ICS Singapore | `GPGY` | GPGY-00891 |
| ECD (Induction Stove) | `GZI` | GZI-00312 |
| EPC (Pressure Cooker) | `GZEP` | GZEP-00187 |

Prefixes are case-insensitive.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List tickets (supports `?status=`, `?product=`, `?priority=`, `?q=`) |
| GET | `/api/tickets/:id` | Single ticket with full timeline |
| POST | `/api/tickets` | Create new ticket |
| PATCH | `/api/tickets/:id/status` | Update ticket status |
| PATCH | `/api/tickets/:id/resolution` | Log resolution (auto-sets status to Resolved) |
| POST | `/api/tickets/:id/note` | Add timeline note |
| GET | `/api/agents` | List agents with ticket stats |
| POST | `/api/agents` | Add agent |
| DELETE | `/api/agents/:id` | Remove agent |
| GET | `/api/carbon` | List carbon credit entries |
| POST | `/api/carbon` | Log new carbon entry |
| PATCH | `/api/carbon/:id/status` | Update carbon entry status |
| GET | `/api/stats` | Dashboard stats and report breakdowns |

---

## Reporting Channels

Agents do not have access to the CRM. They submit issues through:

- **Google Form** — primary channel
- **WhatsApp** — Rachel sends issues to agents and receives resolutions
- **Manual** — agent calls or messages Rachel directly
- **Phone** — customer calls in, Rachel logs the ticket herself

The CRM is used exclusively by the CX Specialist (Rachel Ababio).

---

## Troubleshooting

**`ECONNREFUSED` on port 4000**
The server isn't running. Run `node server.js` first, then refresh the page.

**`password authentication failed for user "postgres"`**
Check that the `DB_PASSWORD` in your `.env` matches your PostgreSQL password.

**Blank tables / no data showing**
Open the browser console (F12 → Console). If you see a CORS or connection error, confirm the server is running on port 4000.

**`relation "tickets" does not exist`**
The database schema hasn't been created yet. Run `db.sql` against your `upenergy_crm` database (see Setup step 4).

---

## Future Improvements

- Authentication (login page for Rachel)
- Google Form webhook integration to auto-create tickets on form submission
- WhatsApp Business API integration
- Email notifications to agents on ticket assignment
- CSV export for tickets
- Mobile-responsive layout