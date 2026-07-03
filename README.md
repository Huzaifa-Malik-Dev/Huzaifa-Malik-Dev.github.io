# Digitalcoo CRM - Demo

Interactive browser prototype of the operations platform for **Digitalcoo Technologies LLC** (e& Authorised Channel Partner).

**Live demo:** open `index.html` in any modern browser, or publish the folder through GitHub Pages/static hosting.

## What this is
A clickable front-end prototype to review the workflow before the real system is built. It covers:

- **DSR - Agent**: calling list, call logs, permanent DSR numbers, duplicate-contact alerts, and change history.
- **Sales Pipeline**: opportunities by stage, weighted forecast, team-leader approval, and Sales Head escalation.
- **Back Office / Orders**: e& order processing with PID, e& order number, activation date, and lifecycle status.
- **MIS & Targets**: target vs submission vs activation, team-leader roll-ups, commission, and CSV export.
- **HR / Payroll / Accounting**: employee master, WPS demo export, gratuity accrual, VAT 5%, Corporate Tax 9%, and IFRS-style P&L.
- **AI Reports**: daily, weekly, and monthly generated summaries with download.
- **Admin**: editable role-based module access, granular capabilities, products/plans, and demo user credentials.

## How to review
Open `index.html`, then use one of the demo credentials shown on the login screen:

| Role | Username | Password |
| --- | --- | --- |
| Agent | `vani` | `vani@2026` |
| Team Leader | `joy` | `joy@2026` |
| Back Office | `ansari` | `ansari@2026` |
| Sales Head | `amirqadri` | `amirqadri@2026` |
| Admin | `admin` | `admin@2026` |

Inside the app, use **Demo walkthrough** or **Demo scenarios** in the sidebar to jump directly into the strongest presentation flows.

## Important notes
- Data is local to each browser through `localStorage`; changes are not shared centrally.
- The imported DSR list is synthetic/anonymized demo data.
- Login, permissions, exports, reports, payroll, and accounting are prototype behavior only.
- Use **Reset demo data** to return to the clean sample scenario.

## Production direction
A production build should add a real backend, database, server-side authentication/RBAC, durable audit trail, file storage, Google Sheets/import connectors, WPS/EmaraTax-ready exports, and automated scheduled reports.