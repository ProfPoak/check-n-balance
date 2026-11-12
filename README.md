# Check'N Balance

**Live app:** https://check-n-balance.netlify.app/

Check'N Balance is a budgeting app for individuals and families who want a quick answer to "where is my money going, and when?" You enter your income, bills and account balances. The app turns every recurring paycheck and bill into a **timeline** of paydays and due dates, rolls that timeline into a **monthly cash flow table**, and **projects your total balance** to any date you pick.

Each user can keep several budgets, real ones and **what-if scenarios** ("what if I buy a new car?").

> The live API runs on Render's free tier and sleeps after 15 minutes of no traffic. The first request after a nap can take about a minute. If you see "Could not reach the server," wait a few seconds and click **Try again**.

---

## Core functionality

- **Accounts:** sign up, log in and log out. Sessions use a secure, HTTP-only cookie, and passwords are hashed with bcrypt. Every budget, item and asset belongs to one user, and the API refuses requests for anyone else's data.
- **Budgets:** create a budget from Home with **Start new budget**. It opens empty and fills in as you add data. You can rename it, add a description, change its "balance as of" date, switch between budgets with the selector, or delete it.
- **Cash flow items:** income and expenses that happen once or repeat (weekly, every 2 weeks, monthly, every 3 months, yearly), with an optional end date.
- **Timeline:** every occurrence of every item over the next six months, grouped by month, with income in green and expenses in red. Monthly items dated the 31st land on the last day of shorter months (Feb 28 or 29) instead of being skipped.
- **Monthly cash flow:** In, Out and Net for the current month and the next five, with an arrow showing whether Net went up or down from the month before. The summary at the top of the page shows the current month.
- **Projected asset value:** add your accounts (checking, savings, or a loan as a negative balance), pick a date, and **Calculate All** projects the combined balance: starting balance + income − expenses between the balance date and that day.
- **Always in sync:** adding, editing or deleting anything immediately updates the timeline, the monthly table and the summary, and clears a projection that's now out of date.

---

## Technologies used

| Layer | Tools |
|---|---|
| Frontend | React 19, React Router 7, Vite, CSS Modules |
| Backend | Python 3.12, Flask, Flask-RESTful (blueprints), Flask-SQLAlchemy, Flask-Migrate (Alembic), marshmallow, Flask-Bcrypt, email-validator, python-dateutil |
| Database | PostgreSQL (money stored as `Numeric(10, 2)` and handled as `Decimal`, never floats) |
| Testing | pytest (backend), Vitest + Testing Library (frontend) |
| Deployment | Netlify (client) · Render (API + PostgreSQL) · gunicorn |

---

## Set up and run locally

### Prerequisites
- Python 3.12 and [pipenv](https://pipenv.pypa.io/)
- Node.js 22 and npm
- PostgreSQL running locally

### 1. Clone and install
```bash
git clone git@github.com:ProfPoak/check-n-balance.git
cd check-n-balance
pipenv install            # backend packages (Pipfile is at the repo root)
cd client && npm install  # frontend packages
cd ..
```

### 2. Create the databases
```bash
createdb check_n_balance
createdb check_n_balance_test
```

### 3. Configure the server
Copy the example environment file and fill in a secret key:
```bash
cp server/.env.example server/.env
python -c "import secrets; print(secrets.token_hex(32))"   # paste the output as SECRET_KEY
```
`server/.env` holds `DATABASE_URL`, `TEST_DATABASE_URL`, `SECRET_KEY` and `FLASK_APP`. The defaults point at the two local databases above.

### 4. Build the tables and load demo data
```bash
cd server
pipenv run flask db upgrade
pipenv run python seed.py
```
The seed creates a demo user with two budgets, **Current** and **New car what-if**:

- **Email:** `demo@example.com`
- **Password:** `password123`

Running `seed.py` again clears every table and starts over.

### 5. Run the app (two terminals)
```bash
# Terminal 1: Flask API on http://localhost:5555
cd server && pipenv run python app.py

# Terminal 2: React app on http://localhost:5173
cd client && npm run dev
```
Open http://localhost:5173. In development, Vite forwards every `/api/...` request to Flask.

### Running the tests
```bash
pipenv run pytest                 # backend, from the repo root (uses check_n_balance_test)
cd client && npx vitest run       # frontend
cd client && npm run lint         # ESLint
```
The backend tests refuse to run unless `TEST_DATABASE_URL` ends in `_test`, so they can't touch your real data.

---

## How it works

### Data models
```
User ──< Budget ──< CashFlowItem
            │
            └────< Asset
```
| Model | Fields |
|---|---|
| **User** | `email` (unique, validated and normalized), `password_hash` |
| **Budget** | `title`, `description`, `balance_as_of`, belongs to a User |
| **CashFlowItem** | `kind` (income / expense), `name`, `amount` (> 0), `start_date`, `end_date`, `interval`, `unit` (once / day / week / month / year), belongs to a Budget |
| **Asset** | `name`, `balance` (can be negative, e.g. a loan), belongs to a Budget |

Deleting a user deletes their budgets, and deleting a budget deletes its items and assets. Validation runs in the models and in marshmallow schemas, and the database backs it up with `CHECK` constraints.

### Recurrence
Occurrence *k* of an item is `start_date + relativedelta(<unit> = interval × k)`, always counted from the original start date. That keeps a bill on the 31st from drifting (Jan 31 → Feb 28 → Mar 31, not Mar 28).

### API

All routes except signup, login and check_session require a logged-in session. Requests for another user's data return **403**.

| Method | Path | Success |
|---|---|---|
| POST | `/signup` | 201, the new user (and logs in) |
| POST | `/login` | 200, the user |
| GET | `/check_session` | 200, the user · 401 if logged out |
| DELETE | `/logout` | 204 |
| GET · POST | `/budgets` | 200, your budgets · 201, the new budget (`{}` is a valid body) |
| GET · PATCH · DELETE | `/budgets/<id>` | 200, the budget with its items and assets · 200 · 204 |
| POST | `/budgets/<id>/cash_flow_items` | 201 |
| PATCH · DELETE | `/cash_flow_items/<id>` | 200 · 204 |
| POST | `/budgets/<id>/assets` | 201 |
| PATCH · DELETE | `/assets/<id>` | 200 · 204 |
| GET | `/budgets/<id>/timeline` | 200, every occurrence this month and the next five |
| GET | `/budgets/<id>/monthly` | 200, six rows of `{month, income, expenses, net}` |
| GET | `/budgets/<id>/projection?to=YYYY-MM-DD` | 200, `{as_of, to, starting_balance, income, expenses, net, projected_balance}` |

Validation errors return **422** with `{"errors": {"field": ["message"]}}`.

### Project structure
```
check-n-balance/
├── Pipfile, pytest.ini        backend dependencies and test config
├── netlify.toml, render.yaml  deployment config
├── server/
│   ├── app.py, config.py      Flask app, database, bcrypt, migrations
│   ├── models/                one file per model
│   ├── schemas/               marshmallow schemas
│   ├── api/                   one blueprint per route group + shared helpers (incl. projection)
│   ├── timeline.py            recurrence and monthly totals
│   ├── seed.py
│   └── tests/
└── client/
    └── src/
        ├── pages/             Login, Signup, Home, Budget, Not found
        ├── components/        auth/, layout/, home/, budget/ (header, items, assets, timeline, monthly)
        ├── hooks/             useFetch, useRequest, useBusy
        ├── context/           AuthContext (session state)
        ├── styles/            CSS Modules, mirroring components/ and pages/
        └── test/
```

---

## Known limitations

- **Twice-monthly pay** (on the 1st and the 15th) isn't a single repeat rule. Enter it as two monthly items.
- **Projections cover all assets together.** Items aren't tied to a specific account.
- **The budget page targets laptop and desktop widths.** Below 1100px the three columns stack into one.
