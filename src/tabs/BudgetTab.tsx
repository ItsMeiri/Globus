import { useMemo, useState } from 'react';
import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Expense, ExpenseCategory, Trip } from '../types';
import { useStore } from '../store';
import { Avatar, Empty, Modal, ProgressBar } from '../components/ui';
import { balances, settleUp } from '../lib/tripLogic';
import { EXPENSE_META, formatDate, money, today, uid } from '../lib/utils';

export function BudgetTab({ trip }: { trip: Trip }) {
  const mutate = useStore((s) => s.mutate);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const cur = trip.currency;

  const spent = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const plannedRes = trip.reservations.reduce((s, r) => s + (r.cost ?? 0), 0);
  const plannedItems = trip.days.reduce((s, d) => s + d.items.reduce((x, i) => x + (i.cost ?? 0), 0), 0);
  const budget = trip.budget ?? 0;
  const over = budget > 0 && spent > budget;

  const byCat = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    trip.expenses.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [trip.expenses]);

  const bal = useMemo(() => balances(trip.expenses, trip.travelers), [trip.expenses, trip.travelers]);
  const transfers = useMemo(() => settleUp(bal), [bal]);
  const traveler = (id?: string) => trip.travelers.find((t) => t.id === id);
  const share = (id: string) =>
    trip.expenses.reduce((s, e) => (e.splitWith.includes(id) && e.splitWith.length ? s + e.amount / e.splitWith.length : s), 0);

  const sorted = [...trip.expenses].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const newExpense = (): Expense => ({
    id: '',
    title: '',
    amount: 0,
    category: 'food',
    date: today() >= trip.startDate && today() <= trip.endDate ? today() : trip.startDate,
    paidBy: trip.travelers[0]?.id,
    splitWith: trip.travelers.map((t) => t.id),
  });

  return (
    <div className="stack">
      <section className="card budget-summary">
        <div className="budget-top">
          <div>
            <span className="stat-label">Spent so far</span>
            <div className={`budget-big ${over ? 'over' : ''}`}>{money(spent, cur)}</div>
            <div className="muted small">
              {budget > 0 ? (over ? `${money(spent - budget, cur)} over budget` : `${money(budget - spent, cur)} left of ${money(budget, cur)}`) : 'Set a budget to track progress'}
            </div>
          </div>
          <div className="budget-set">
            <label className="field">
              <span>Trip budget ({cur})</span>
              <input
                type="number"
                min="0"
                value={budgetDraft ?? (trip.budget ?? '')}
                placeholder="No budget"
                onChange={(e) => setBudgetDraft(e.target.value)}
                onBlur={() => {
                  if (budgetDraft === null) return;
                  mutate(trip.id, (t) => void (t.budget = budgetDraft ? Number(budgetDraft) : undefined));
                  setBudgetDraft(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            </label>
          </div>
        </div>
        {budget > 0 && <ProgressBar value={spent} max={budget} color={over ? 'var(--danger)' : spent / budget > 0.8 ? 'var(--warning)' : 'var(--success)'} />}
        <div className="facts">
          <div className="fact">
            <span>Booked reservations</span>
            <strong>{money(plannedRes, cur)}</strong>
          </div>
          <div className="fact">
            <span>Itinerary costs</span>
            <strong>{money(plannedItems, cur)}</strong>
          </div>
          <div className="fact">
            <span>Per person (avg)</span>
            <strong>{money(trip.travelers.length ? spent / trip.travelers.length : 0, cur)}</strong>
          </div>
          <div className="fact">
            <span>Per day (avg)</span>
            <strong>{money(trip.days.length ? spent / trip.days.length : 0, cur)}</strong>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h3>By category</h3>
          </div>
          {byCat.length === 0 ? (
            <p className="muted small">Categories appear once you log expenses.</p>
          ) : (
            <>
              <div className="stacked-bar" role="img" aria-label="Spending by category">
                {byCat.map(([c, v]) => (
                  <span key={c} style={{ width: `${(v / spent) * 100}%`, background: EXPENSE_META[c].color }} title={`${EXPENSE_META[c].label}: ${money(v, cur)}`} />
                ))}
              </div>
              <ul className="cat-list">
                {byCat.map(([c, v]) => (
                  <li key={c}>
                    <span className="dot" style={{ background: EXPENSE_META[c].color }} />
                    <span className="grow">
                      {EXPENSE_META[c].emoji} {EXPENSE_META[c].label}
                    </span>
                    <span className="muted small">{Math.round((v / spent) * 100)}%</span>
                    <strong>{money(v, cur)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Split & settle up</h3>
          </div>
          {trip.travelers.length < 2 ? (
            <p className="muted small">Add tripmates in the Details tab to split costs.</p>
          ) : (
            <>
              <ul className="balance-list">
                {trip.travelers.map((t) => {
                  const b = bal[t.id] ?? 0;
                  return (
                    <li key={t.id}>
                      <Avatar t={t} size={26} />
                      <span className="grow">
                        {t.name}
                        <small className="muted"> · share {money(share(t.id), cur)}</small>
                      </span>
                      <strong className={b > 0.005 ? 'pos' : b < -0.005 ? 'neg' : 'muted'}>
                        {b > 0.005 ? `gets ${money(b, cur)}` : b < -0.005 ? `owes ${money(-b, cur)}` : 'settled'}
                      </strong>
                    </li>
                  );
                })}
              </ul>
              {transfers.length > 0 && (
                <>
                  <h4>Suggested payments</h4>
                  <ul className="transfer-list">
                    {transfers.map((tr, i) => (
                      <li key={i}>
                        <strong>{traveler(tr.from)?.name}</strong>
                        <ArrowRight size={14} />
                        <strong>{traveler(tr.to)?.name}</strong>
                        <span className="grow" />
                        <span>{money(tr.amount, cur)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Expenses</h3>
          <button className="btn sm primary" onClick={() => setEditing(newExpense())}>
            <Plus size={14} /> Add expense
          </button>
        </div>
        {sorted.length === 0 ? (
          <Empty emoji="🧾" title="No expenses yet">
            Log what you spend and Globus will split it between tripmates.
          </Empty>
        ) : (
          <ul className="expense-list">
            {sorted.map((e) => (
              <li key={e.id}>
                <span className="exp-emoji" style={{ background: EXPENSE_META[e.category].color + '22' }}>
                  {EXPENSE_META[e.category].emoji}
                </span>
                <div className="grow">
                  <div className="exp-title">{e.title}</div>
                  <div className="muted small">
                    {e.date && formatDate(e.date, { month: 'short', day: 'numeric' })}
                    {traveler(e.paidBy) && ` · paid by ${traveler(e.paidBy)!.name}`}
                    {e.splitWith.length > 0 && ` · split ${e.splitWith.length} way${e.splitWith.length === 1 ? '' : 's'}`}
                  </div>
                </div>
                <strong>{money(e.amount, cur)}</strong>
                <button className="icon-btn sm" aria-label="Edit expense" onClick={() => setEditing(e)}>
                  <Pencil size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <ExpenseModal
          trip={trip}
          value={editing}
          onClose={() => setEditing(null)}
          onDelete={
            editing.id
              ? () => {
                  mutate(trip.id, (t) => void (t.expenses = t.expenses.filter((x) => x.id !== editing.id)));
                  setEditing(null);
                }
              : undefined
          }
          onSave={(e) => {
            mutate(trip.id, (t) => {
              if (e.id) t.expenses = t.expenses.map((x) => (x.id === e.id ? e : x));
              else t.expenses.push({ ...e, id: uid('e_') });
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ExpenseModal({
  trip,
  value,
  onClose,
  onSave,
  onDelete,
}: {
  trip: Trip;
  value: Expense;
  onClose: () => void;
  onSave: (e: Expense) => void;
  onDelete?: () => void;
}) {
  const [e, setE] = useState(value);
  const [amount, setAmount] = useState(value.amount ? String(value.amount) : '');
  const valid = e.title.trim() && Number(amount) > 0;
  return (
    <Modal title={value.id ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (valid) onSave({ ...e, title: e.title.trim(), amount: Number(amount) });
        }}
      >
        <div className="row-2">
          <label className="field">
            <span>Description</span>
            <input autoFocus value={e.title} placeholder="Dinner, taxi, tickets…" onChange={(x) => setE({ ...e, title: x.target.value })} />
          </label>
          <label className="field">
            <span>Amount ({trip.currency})</span>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(x) => setAmount(x.target.value)} />
          </label>
        </div>
        <div className="field">
          <span>Category</span>
          <div className="chip-row wrap">
            {(Object.keys(EXPENSE_META) as ExpenseCategory[]).map((c) => (
              <button type="button" key={c} className={`cat-chip ${e.category === c ? 'on' : ''}`} onClick={() => setE({ ...e, category: c })}>
                {EXPENSE_META[c].emoji} {EXPENSE_META[c].label}
              </button>
            ))}
          </div>
        </div>
        <div className="row-2">
          <label className="field">
            <span>Date</span>
            <input type="date" value={e.date ?? ''} onChange={(x) => setE({ ...e, date: x.target.value })} />
          </label>
          <label className="field">
            <span>Paid by</span>
            <select value={e.paidBy ?? ''} onChange={(x) => setE({ ...e, paidBy: x.target.value || undefined })}>
              <option value="">—</option>
              {trip.travelers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {trip.travelers.length > 1 && (
          <div className="field">
            <span>
              Split equally between
              {Number(amount) > 0 && e.splitWith.length > 0 && <em className="muted"> · {money(Number(amount) / e.splitWith.length, trip.currency)} each</em>}
            </span>
            <div className="chip-row wrap">
              {trip.travelers.map((t) => {
                const on = e.splitWith.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    className={`cat-chip ${on ? 'on' : ''}`}
                    onClick={() => setE({ ...e, splitWith: on ? e.splitWith.filter((x) => x !== t.id) : [...e.splitWith, t.id] })}
                  >
                    <Avatar t={t} size={18} /> {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="modal-actions">
          {onDelete && (
            <button type="button" className="btn ghost danger" onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <div className="grow" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
