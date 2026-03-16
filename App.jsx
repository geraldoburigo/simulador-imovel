import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#f0f4f9",
  panel: "#ffffff",
  border: "#dce6f0",
  text: "#0f2d4e",
  muted: "#5a7490",
  soft: "#e8f0fa",
  sac: "#2563eb",
  price: "#f97316",
  cons: "#16a34a",
  highlight: "#f0fdf4",
  highlightBorder: "#86efac",
};

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const brl = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

const fmtCurrency = (v) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(v) || 0);

const parseDigits = (v) => Number(String(v || "").replace(/\D/g, "") || "0") / 100;

const parsePct = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(
    String(v).replace(/\s/g,"").replace(/%/g,"")
      .replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"")
  );
  return Number.isFinite(n) ? n : 0;
};

const fmtPct = (v) =>
  `${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const annualToMonthly = (a) => (1 + (Number(a) || 0) / 100) ** (1 / 12) - 1;

const pmtFn = (pv, r, n) => {
  if (n <= 0) return 0;
  if (Math.abs(r) < 1e-12) return pv / n;
  return pv * (r * (1 + r) ** n) / ((1 + r) ** n - 1);
};

// ─── CALC: SAC ────────────────────────────────────────────────────────────────
function calcSac(principal, rM, trM, months) {
  if (principal <= 0 || months <= 0) return { rows: [], totals: {} };
  const amort = principal / months;
  let bal = principal;
  let cumInstall = 0, cumInterest = 0, cumTR = 0, cumAmort = 0;
  const rows = Array.from({ length: months }, (_, i) => {
    const tr = bal * trM;
    bal += tr;
    const interest = bal * rM;
    const installment = amort + interest;
    bal = Math.max(bal - amort, 0);
    cumInstall  += installment;
    cumInterest += interest;
    cumTR       += tr;
    cumAmort    += amort;
    return { month: i + 1, installment, interest, tr, amort, bal, cumInstall, cumInterest, cumTR, cumAmort };
  });
  const last = rows[rows.length - 1];
  return {
    rows,
    totals: {
      installFirst:  rows[0].installment,
      installLast:   last.installment,
      totalInterest: last.cumInterest,
      totalTR:       last.cumTR,
      totalAmort:    last.cumAmort,
      totalPaid:     last.cumInstall,
    },
  };
}

// ─── CALC: PRICE ──────────────────────────────────────────────────────────────
function calcPrice(principal, rM, trM, months) {
  if (principal <= 0 || months <= 0) return { rows: [], totals: {} };
  let bal = principal;
  let cumInstall = 0, cumInterest = 0, cumTR = 0, cumAmort = 0;
  const rows = Array.from({ length: months }, (_, i) => {
    const remaining = months - i;
    const tr = bal * trM;
    bal += tr;
    const installment = pmtFn(bal, rM, remaining);
    const interest = bal * rM;
    const amort = Math.max(installment - interest, 0);
    bal = Math.max(bal - amort, 0);
    cumInstall  += installment;
    cumInterest += interest;
    cumTR       += tr;
    cumAmort    += amort;
    return { month: i + 1, installment, interest, tr, amort, bal, cumInstall, cumInterest, cumTR, cumAmort };
  });
  const last = rows[rows.length - 1];
  return {
    rows,
    totals: {
      installFirst:  rows[0].installment,
      installLast:   last.installment,
      totalInterest: last.cumInterest,
      totalTR:       last.cumTR,
      totalAmort:    principal, // sempre o principal original — TR já está na linha própria
      totalPaid:     last.cumInstall,
    },
  };
}

// ─── CALC: CONSÓRCIO ──────────────────────────────────────────────────────────
function calcConsorcio(carta, months, adminPct, fundoReservaPct, idxM, cm, lance) {
  if (carta <= 0 || months <= 0) return { rows: [], totals: {}, meta: {} };

  const lanceSafe = Math.max(Number(lance) || 0, 0);
  const fundoCost = carta * fundoReservaPct;
  const grossTotal = carta * (1 + adminPct + fundoReservaPct); // fundo diluído nas parcelas
  const parcelaBase = grossTotal / months;

  const fatorCm = (1 + idxM) ** (cm - 1);
  const cartaTravada = carta * fatorCm;
  const grossAtual = grossTotal * fatorCm;
  const paidCm = parcelaBase * fatorCm * cm;
  const saldoBruto = Math.max(grossAtual - paidCm, 0);
  const lanceEfetivo = Math.min(lanceSafe, saldoBruto);
  const saldoPos = Math.max(saldoBruto - lanceEfetivo, 0);
  const mesesPos = months - cm;
  const parcelaPosBase = mesesPos > 0 ? saldoPos / mesesPos : 0;

  const adminCost = carta * adminPct;
  let idxPre = 0, idxPos = 0, cumInstall = 0;

  const rows = Array.from({ length: months }, (_, i) => {
    const m = i + 1;
    let installment, idxAdj;

    if (m <= cm) {
      installment = parcelaBase * (1 + idxM) ** (m - 1);
      idxAdj = installment - parcelaBase;
      idxPre += idxAdj;
    } else {
      const fRel = (1 + idxM) ** (m - cm);
      installment = parcelaPosBase * fRel;
      idxAdj = installment - parcelaPosBase;
      idxPos += idxAdj;
    }

    if (m === cm) cumInstall += lanceEfetivo;
    cumInstall += installment;

    return { month: m, installment, idxAdj, cumInstall, isPos: m > cm };
  });

  const last = rows[rows.length - 1];

  // Amortização no consórcio = carta travada (o principal que o cotista de fato recebe)
  // Lance é amortização antecipada, não entra como custo
  const totalAmort = cartaTravada;

  return {
    rows,
    totals: {
      installFirst:  rows[0].installment,
      installLast:   last.installment,
      totalAdm:      adminCost,
      totalFundo:    fundoCost,
      totalIdxPre:   idxPre,
      totalIdxPos:   idxPos,
      totalPaid:     last.cumInstall,
      totalAmort,
      cartaTravada,
      lanceEfetivo,
    },
    meta: { cartaTravada, lanceEfetivo, adminCost, fundoCost, idxPre, idxPos, cm },
  };
}

// ─── INPUT COMPONENTS ─────────────────────────────────────────────────────────
const iStyle = () => ({
  width: "100%", marginTop: 4, padding: "10px 12px",
  border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13,
  background: "#fff", boxSizing: "border-box", color: C.text, outline: "none",
});

function InputMoney({ label, value, onChange, hint }) {
  const [d, setD] = useState(fmtCurrency(value));
  useEffect(() => { setD(fmtCurrency(value)); }, [value]);
  return (
    <label style={{ fontSize: 13, color: C.text, display: "block" }}>
      <div style={{ marginBottom: 2, fontWeight: 500 }}>{label}</div>
      <input type="text" inputMode="numeric" value={d}
        onChange={e => { const n = parseDigits(e.target.value); setD(fmtCurrency(n)); onChange(n); }}
        style={iStyle()} />
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hint}</div>}
    </label>
  );
}

function InputPct({ label, value, onChange, hint }) {
  return (
    <label style={{ fontSize: 13, color: C.text, display: "block" }}>
      <div style={{ marginBottom: 2, fontWeight: 500 }}>{label}</div>
      <input type="text" inputMode="decimal" value={fmtPct(value)}
        onChange={e => onChange(parsePct(e.target.value))} style={iStyle()} />
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hint}</div>}
    </label>
  );
}

function InputInt({ label, value, onChange, hint }) {
  return (
    <label style={{ fontSize: 13, color: C.text, display: "block" }}>
      <div style={{ marginBottom: 2, fontWeight: 500 }}>{label}</div>
      <input type="number" value={value}
        onChange={e => onChange(Number(e.target.value))} style={iStyle()} />
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hint}</div>}
    </label>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function InputCard({ color, title, children }) {
  return (
    <div style={{
      background: C.panel, border: `2px solid ${color}`,
      borderRadius: 18, padding: 20,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16,
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function SectionHeader({ label }) {
  return (
    <tr>
      <td colSpan={4} style={{
        padding: "9px 16px",
        background: C.soft,
        fontSize: 11, fontWeight: 700,
        color: C.muted,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        borderBottom: `1px solid ${C.border}`,
        borderTop: `1px solid ${C.border}`,
      }}>{label}</td>
    </tr>
  );
}

function Row({ label, sub, sac, price, cons, hlMin, even }) {
  const vals = [
    { v: sac,   color: C.sac },
    { v: price, color: C.price },
    { v: cons,  color: C.cons },
  ];
  const nums = vals.map(x => x.v).filter(v => typeof v === "number");
  const minVal = hlMin && nums.length ? Math.min(...nums) : null;

  const renderVal = ({ v, color }) => {
    if (v === null || v === undefined) return <span style={{ color: C.muted }}>—</span>;
    if (typeof v === "string") return <span style={{ color: C.text }}>{v}</span>;
    const isMin = hlMin && v === minVal;
    return (
      <span style={{ fontWeight: isMin ? 700 : 400, color: isMin ? color : C.text }}>
        {brl(v)}
      </span>
    );
  };

  return (
    <tr style={{ background: even ? "#f8fafc" : "#ffffff" }}>
      <td style={{
        padding: "11px 16px", fontSize: 13, color: C.text,
        borderBottom: `1px solid ${C.border}`, width: "34%",
      }}>
        <div style={{ fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{sub}</div>}
      </td>
      {vals.map((item, i) => (
        <td key={i} style={{
          padding: "11px 16px", fontSize: 13, textAlign: "center",
          borderBottom: `1px solid ${C.border}`,
          background: hlMin && item.v === minVal ? C.highlight : "transparent",
          whiteSpace: "nowrap",
        }}>
          {renderVal(item)}
        </td>
      ))}
    </tr>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 18, padding: 22,
      boxShadow: "0 6px 24px rgba(15,45,78,0.06)",
      marginBottom: 20,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.muted, marginTop: 3, marginBottom: 14 }}>{subtitle}</div>}
      <div style={{ width: "100%", height: 300 }}>{children}</div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [imovel,    setImovel]    = useState(500000);
  const [entrada,   setEntrada]   = useState(100000);
  const [fgts,      setFgts]      = useState(0);
  const [juros,     setJuros]     = useState(11);
  const [trAnual,   setTrAnual]   = useState(1);
  const [prazoFin,  setPrazoFin]  = useState(200);

  const [carta,     setCarta]     = useState(500000);
  const [admin,     setAdmin]     = useState(20);
  const [idxAnual,  setIdxAnual]  = useState(6);
  const [prazoCons, setPrazoCons] = useState(200);
  const [cmMes,     setCmMes]     = useState(80);
  const [lance,     setLance]     = useState(0);
  const [fundo,     setFundo]     = useState(2);
  const [aluguel,   setAluguel]   = useState(0);

  const rM   = useMemo(() => annualToMonthly(juros),   [juros]);
  const trM  = useMemo(() => annualToMonthly(trAnual), [trAnual]);
  const idxM = useMemo(() => annualToMonthly(idxAnual),[idxAnual]);

  const cmSafe = Math.min(
    Math.max(Number(cmMes) || 1, 1),
    Math.max(Number(prazoCons) || 1, 1)
  );
  const principal = Math.max(imovel - entrada - fgts, 0);

  const sac   = useMemo(() => calcSac(principal, rM, trM, prazoFin),   [principal, rM, trM, prazoFin]);
  const price = useMemo(() => calcPrice(principal, rM, trM, prazoFin), [principal, rM, trM, prazoFin]);
  const cons  = useMemo(() => calcConsorcio(carta, prazoCons, admin / 100, fundo / 100, idxM, cmSafe, lance),
    [carta, prazoCons, admin, fundo, idxM, cmSafe, lance]);

  const st = sac.totals;
  const pt = price.totals;
  const ct = cons.totals;

  // Aluguel reajustado pelo indexador mês a mês até a contemplação
  const aluguelMensal = Number(aluguel) || 0;
  const aluguelPorMes = useMemo(() => {
    if (aluguelMensal <= 0) return [];
    return Array.from({ length: cmSafe }, (_, i) =>
      aluguelMensal * (1 + idxM) ** i
    );
  }, [aluguelMensal, cmSafe, idxM]);
  const aluguelTotal = aluguelPorMes.reduce((a, v) => a + v, 0);

  // Desembolso total = parcelas + entrada (fin) ou parcelas + lance + aluguel espera (cons)
  const sacTotal     = (st.totalPaid || 0) + entrada + fgts;
  const priceTotal   = (pt.totalPaid || 0) + entrada + fgts;
  const consTotal    = (ct.totalPaid || 0) + aluguelTotal;

  // Chart data
  const maxM = Math.min(
    Math.max(sac.rows.length, price.rows.length, cons.rows.length),
    360
  );

  const chartParcelas = useMemo(() =>
    Array.from({ length: maxM }, (_, i) => ({
      month: i + 1,
      SAC:       sac.rows[i]?.installment   ?? null,
      Price:     price.rows[i]?.installment ?? null,
      Consórcio: cons.rows[i]?.installment  ?? null,
    }))
  , [sac.rows, price.rows, cons.rows, maxM]);

  const chartDesembolso = useMemo(() => {
    // aluguel acumulado mês a mês (reajustado pelo indexador até a contemplação)
    let aluguelCum = 0;
    return Array.from({ length: maxM }, (_, i) => {
      if (i < aluguelPorMes.length) aluguelCum += aluguelPorMes[i];
      return {
        month: i + 1,
        SAC:       sac.rows[i]   ? sac.rows[i].cumInstall   + entrada + fgts : null,
        Price:     price.rows[i] ? price.rows[i].cumInstall + entrada + fgts : null,
        Consórcio: cons.rows[i]  ? cons.rows[i].cumInstall + aluguelCum : null,
      };
    });
  }, [sac.rows, price.rows, cons.rows, maxM, entrada, aluguelPorMes]);

  // Patrimônio líquido mês a mês
  // SAC/Price:  valor do imóvel reajustado − saldo devedor  (desde o mês 1)
  // Consórcio:  0 até contemplação; depois valor do imóvel reajustado a partir do mês cm − saldo devedor
  const chartPatrimonio = useMemo(() => {
    return Array.from({ length: maxM }, (_, i) => {
      const m = i + 1;
      const imovelReajustado = imovel * (1 + idxM) ** m;

      // SAC: imóvel valoriza desde mês 1, saldo devedor cai
      const sacPatr = sac.rows[i]
        ? Math.max(imovelReajustado - sac.rows[i].bal, 0)
        : null;

      // Price: mesmo raciocínio
      const pricePatr = price.rows[i]
        ? Math.max(imovelReajustado - price.rows[i].bal, 0)
        : null;

      // Consórcio: antes da contemplação patrimônio = 0
      // após contemplação: imóvel reajustado a partir do mês cm
      let consPatr = null;
      if (cons.rows[i]) {
        if (m < cmSafe) {
          consPatr = 0;
        } else {
          const imovelConsorcio = cons.meta.cartaTravada * (1 + idxM) ** (m - cmSafe);
          const saldoCons = cons.rows[i].balance || 0;
          consPatr = Math.max(imovelConsorcio - saldoCons, 0);
        }
      }

      return { month: m, SAC: sacPatr, Price: pricePatr, Consórcio: consPatr };
    });
  }, [sac.rows, price.rows, cons.rows, maxM, imovel, idxM, cmSafe, cons.meta]);

  const thStyle = (color) => ({
    padding: "13px 16px", fontSize: 13, fontWeight: 700,
    textAlign: "center", color: color || C.text,
    borderBottom: `1px solid ${C.border}`,
    background: C.soft,
  });

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif", background: C.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
            Comparador de Aquisição de Imóvel
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>
            SAC · Price · Consórcio — custo total ao final do prazo
          </p>
        </div>

        {/* INPUTS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

          <InputCard color={C.sac} title="Financiamento (SAC e Price)">
            <InputMoney label="Valor do imóvel" value={imovel}  onChange={setImovel} />
            <InputMoney label="Entrada"         value={entrada} onChange={setEntrada} />
            <InputMoney label="FGTS"            value={fgts}    onChange={setFgts}
              hint="Opcional · reduz o principal financiado" />
            <InputPct label="CET anual" value={juros} onChange={setJuros}
              hint={`Financia ${brl(principal)} · CET já inclui juros, seguros e demais taxas`} />
            <InputPct label="TR anual"          value={trAnual} onChange={setTrAnual} />
            <InputInt label="Prazo (meses)"     value={prazoFin} onChange={setPrazoFin} />
          </InputCard>

          <InputCard color={C.cons} title="Consórcio">
            <InputMoney label="Carta de crédito"      value={carta}     onChange={setCarta} />
            <InputPct   label="Taxa de administração" value={admin}     onChange={setAdmin} />
            <InputPct   label="Fundo de reserva"      value={fundo}     onChange={setFundo}
              hint="Típico: 2% a 4% da carta · tratado como custo (eventual devolução = bônus)" />
            <InputPct   label="Indexador anual"       value={idxAnual}  onChange={setIdxAnual} />
            <InputInt   label="Prazo (meses)"         value={prazoCons} onChange={setPrazoCons} />
            <InputInt   label="Mês de contemplação"   value={cmMes}     onChange={setCmMes}
              hint="Estimativa — sem garantia de data" />
            <InputMoney label="Lance próprio"         value={lance}     onChange={setLance}
              hint="Abate o saldo devedor na contemplação" />
            <InputMoney label="Aluguel mensal durante espera" value={aluguel} onChange={setAluguel}
              hint={aluguel > 0 ? `Reajustado pelo indexador · total estimado: ${brl(aluguelTotal)}` : "Deixe em branco para ignorar"} />
          </InputCard>

        </div>

        {/* TABELA */}
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 18, boxShadow: "0 6px 24px rgba(15,45,78,0.06)",
          marginBottom: 20, overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Resultado comparativo</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              Verde = menor valor na linha.
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table cellPadding="0" style={{
              borderCollapse: "separate", borderSpacing: 0,
              width: "100%", minWidth: 560,
            }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle(), textAlign: "left", width: "34%" }}></th>
                  <th style={thStyle(C.sac)}>SAC</th>
                  <th style={thStyle(C.price)}>Price</th>
                  <th style={thStyle(C.cons)}>Consórcio</th>
                </tr>
              </thead>
              <tbody>

                {/* PARCELAS */}
                <SectionHeader label="Parcelas" />
                <Row label="Parcela inicial"
                  sac={st.installFirst} price={pt.installFirst} cons={ct.installFirst}
                  hlMin even={false} />
                <Row label="Parcela final"
                  sac={st.installLast} price={pt.installLast} cons={ct.installLast}
                  hlMin even />

                {/* CUSTOS */}
                <SectionHeader label="Custos" />
                <Row label="Juros + seguros + taxas (CET)"
                  sub="Custo Efetivo Total contratado"
                  sac={st.totalInterest} price={pt.totalInterest} cons={null}
                  even={false} />
                <Row label="TR"
                  sac={st.totalTR} price={pt.totalTR} cons={null}
                  even />
                <Row label="Taxa de administração"
                  sac={null} price={null} cons={ct.totalAdm}
                  even={false} />
                <Row label="Fundo de reserva"
                  sub="Pode ser devolvido ao final se houver saldo — tratado como custo"
                  sac={null} price={null} cons={ct.totalFundo}
                  even />
                <Row label="Indexador pré-contemplação"
                  sub="Carta e parcela crescem juntas"
                  sac={null} price={null} cons={ct.totalIdxPre}
                  even />
                <Row label="Indexador pós-contemplação"
                  sub="Carta travada, parcela ainda cresce — custo puro"
                  sac={null} price={null} cons={ct.totalIdxPos}
                  even={false} />

                {/* DESEMBOLSO */}
                <SectionHeader label="Desembolso total" />
                <Row label="Amortização"
                  sub="Capital devolvido ao imóvel"
                  sac={st.totalAmort} price={pt.totalAmort} cons={ct.totalAmort}
                  even={false} />
                <Row label="Juros + seguros + taxas (CET)"
                  sac={st.totalInterest} price={pt.totalInterest} cons={null}
                  even />
                <Row label="TR paga"
                  sac={st.totalTR} price={pt.totalTR} cons={null}
                  even={false} />
                <Row label="Taxa de administração"
                  sac={null} price={null} cons={ct.totalAdm}
                  even />
                <Row label="Fundo de reserva"
                  sac={null} price={null} cons={ct.totalFundo}
                  even={false} />
                <Row label="Indexador total"
                  sac={null} price={null} cons={(ct.totalIdxPre || 0) + (ct.totalIdxPos || 0)}
                  even={false} />
                <Row label="Entrada / lance"
                  sac={entrada} price={entrada} cons={ct.lanceEfetivo}
                  even />
                <Row label="FGTS utilizado"
                  sub="Reduz o principal financiado"
                  sac={fgts > 0 ? fgts : null} price={fgts > 0 ? fgts : null} cons={null}
                  even={false} />
                <Row
                  label="Aluguel durante espera"
                  sub={aluguelTotal > 0 ? `${cmSafe} meses · reajustado pelo indexador (${brl(aluguel)} → ${brl(aluguelPorMes[aluguelPorMes.length - 1] || aluguel)})` : "Não informado"}
                  sac={null} price={null} cons={aluguelTotal > 0 ? aluguelTotal : null}
                  even={false} />

                {/* TOTAL — linha destacada */}
                {(() => {
                  const vals = [sacTotal, priceTotal, consTotal];
                  const minV = Math.min(...vals);
                  const colors = [C.sac, C.price, C.cons];
                  return (
                    <tr style={{ background: "#f0f9ff" }}>
                      <td style={{
                        padding: "13px 16px", fontSize: 14, fontWeight: 700,
                        color: C.text, borderBottom: `1px solid ${C.border}`,
                        borderTop: `2px solid ${C.border}`,
                      }}>
                        Total desembolsado
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginTop: 1 }}>
                          Parcelas + entrada / lance
                        </div>
                      </td>
                      {vals.map((v, i) => (
                        <td key={i} style={{
                          padding: "13px 16px", fontSize: 14, textAlign: "center",
                          fontWeight: v === minV ? 700 : 500,
                          color: v === minV ? colors[i] : C.text,
                          background: v === minV ? C.highlight : "#f0f9ff",
                          borderBottom: `1px solid ${C.border}`,
                          borderTop: `2px solid ${C.border}`,
                          whiteSpace: "nowrap",
                        }}>
                          {brl(v)}
                        </td>
                      ))}
                    </tr>
                  );
                })()}

                {/* CRÉDITO */}
                <SectionHeader label="Crédito recebido" />
                <Row
                  label="Valor financiado / carta de crédito"
                  sub="SAC e Price: crédito imediato · Consórcio: carta reajustada na contemplação"
                  sac={principal} price={principal} cons={ct.cartaTravada}
                  even={false} />
                <Row
                  label="Acesso ao imóvel"
                  sac="Mês 1" price="Mês 1"
                  cons={`Mês ${cmSafe} (estimativa)`}
                  even />
                {(() => {
                  const sacCusto   = (st.totalInterest || 0) + (st.totalTR || 0);
                  const priceCusto = (pt.totalInterest || 0) + (pt.totalTR || 0);
                  const consCusto  = (ct.totalAdm || 0) + (ct.totalFundo || 0) + (ct.totalIdxPre || 0) + (ct.totalIdxPos || 0);
                  const sacPct   = principal        > 0 ? (sacCusto   / principal)       * 100 : 0;
                  const pricePct = principal        > 0 ? (priceCusto / principal)       * 100 : 0;
                  const consPct  = ct.cartaTravada  > 0 ? (consCusto  / ct.cartaTravada) * 100 : 0;
                  const vals   = [sacPct, pricePct, consPct];
                  const minV   = Math.min(...vals);
                  const colors = [C.sac, C.price, C.cons];
                  return (
                    <tr style={{ background: "#f8fafc" }}>
                      <td style={{
                        padding: "13px 16px", fontSize: 13, color: C.text,
                        borderBottom: `1px solid ${C.border}`,
                      }}>
                        <div style={{ fontWeight: 700 }}>Custo puro % do crédito recebido</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                          (Juros+TR) ÷ principal · (Adm+Indexador) ÷ carta reajustada
                        </div>
                      </td>
                      {vals.map((v, i) => (
                        <td key={i} style={{
                          padding: "13px 16px", fontSize: 13, textAlign: "center",
                          fontWeight: v === minV ? 700 : 400,
                          color: v === minV ? colors[i] : C.text,
                          background: v === minV ? C.highlight : "#f8fafc",
                          borderBottom: `1px solid ${C.border}`,
                          whiteSpace: "nowrap",
                        }}>
                          {v.toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                  );
                })()}

              </tbody>
            </table>
          </div>
        </div>

        {/* GRÁFICO PARCELAS */}
        <ChartCard
          title="Evolução das parcelas"
          subtitle="Parcela mês a mês em cada modalidade."
        >
          <ResponsiveContainer>
            <LineChart data={chartParcelas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2eaf4" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => brl(v)} />
              <Legend />
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="4 4"
                label={{ value: "Contemplação", fill: C.cons, fontSize: 10 }} />
              <Line type="monotone" dataKey="SAC"       stroke={C.sac}   strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Price"     stroke={C.price} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons}  strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* GRÁFICO DESEMBOLSO ACUMULADO */}
        <ChartCard
          title="Desembolso total acumulado"
          subtitle="Tudo que saiu do bolso (parcelas + entrada/lance) acumulado mês a mês."
        >
          <ResponsiveContainer>
            <LineChart data={chartDesembolso}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2eaf4" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => brl(v)} />
              <Legend />
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="4 4"
                label={{ value: "Contemplação", fill: C.cons, fontSize: 10 }} />
              <Line type="monotone" dataKey="SAC"       stroke={C.sac}   strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Price"     stroke={C.price} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons}  strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* GRÁFICO PATRIMÔNIO LÍQUIDO */}
        <ChartCard
          title="Patrimônio líquido ao longo do tempo"
          subtitle="Valor do imóvel reajustado pelo indexador menos o saldo devedor. Consórcio começa do zero — patrimônio só existe após a contemplação."
        >
          <ResponsiveContainer>
            <LineChart data={chartPatrimonio}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2eaf4" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => brl(v)} />
              <Legend />
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="4 4"
                label={{ value: "Contemplação", fill: C.cons, fontSize: 10 }} />
              <Line type="monotone" dataKey="SAC"       stroke={C.sac}   strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Price"     stroke={C.price} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons}  strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* NOTA */}
        <div style={{
          background: "#fffbeb", border: `1px solid #fcd34d`,
          borderRadius: 12, padding: 14,
          fontSize: 12, color: "#78350f", lineHeight: 1.7,
        }}>
          <strong>Premissas do gráfico de patrimônio líquido:</strong> imóvel reajustado pelo indexador do consórcio desde o mês 1 (financiamento) ou desde a contemplação (consórcio).
          Antes da contemplação o consórcio tem patrimônio zero — a carta é uma promessa de crédito, não um ativo.
          Não considera FGTS, benfeitorias ou variações de mercado acima do indexador.
        </div>

      </div>
    </div>
  );
}
