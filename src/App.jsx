import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

const COLORS = {
  bg: "#f4f7fb",
  panel: "#ffffff",
  border: "#dbe5f0",
  text: "#163a63",
  muted: "#5f7692",
  soft: "#eef4fb",
  positive: "#e8f7ee",
  sac: "#2563eb",
  price: "#f97316",
  consorcio: "#16a34a",
  marker: "#b91c1c",
};

const currency = (v) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(v) || 0);

const percent = (v) => `${(Number(v) || 0).toFixed(2)}%`;

function annualToMonthly(rateAnnualPct) {
  return (1 + (Number(rateAnnualPct) || 0) / 100) ** (1 / 12) - 1;
}

function pmt(principal, rate, months) {
  if (months <= 0) return 0;
  if (Math.abs(rate) < 1e-12) return principal / months;
  return principal * ((rate * (1 + rate) ** months) / ((1 + rate) ** months - 1));
}

function sum(arr, key) {
  return arr.reduce((acc, v) => acc + (v[key] || 0), 0);
}

function bestOf(options, mode = "min") {
  const filtered = options.filter((x) => Number.isFinite(x.value));
  if (!filtered.length) return "-";
  filtered.sort((a, b) => (mode === "min" ? a.value - b.value : b.value - a.value));
  return filtered[0].label;
}

function parseBrNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const normalized = String(value)
    .replace(/\s/g, "")
    .replace(/%/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrencyInput(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function parseCurrencyDigitsToNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return Number(digits || "0") / 100;
}

function formatPercentInput(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function baseInputStyle() {
  return {
    width: "100%",
    marginTop: 6,
    padding: "12px 14px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    fontSize: 14,
    background: "#fff",
    boxSizing: "border-box",
    color: COLORS.text,
    outline: "none",
  };
}

function InputMoney({ label, value, onChange }) {
  const [displayValue, setDisplayValue] = useState(formatCurrencyInput(value));

  useEffect(() => {
    setDisplayValue(formatCurrencyInput(value));
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    const numericValue = parseCurrencyDigitsToNumber(raw);
    setDisplayValue(formatCurrencyInput(numericValue));
    onChange(numericValue);
  };

  return (
    <label style={{ fontSize: 14, color: COLORS.text, display: "block" }}>
      <div style={{ marginBottom: 2 }}>{label}</div>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        style={baseInputStyle()}
      />
    </label>
  );
}

function InputPercent({ label, value, onChange }) {
  return (
    <label style={{ fontSize: 14, color: COLORS.text, display: "block" }}>
      <div style={{ marginBottom: 2 }}>{label}</div>
      <input
        type="text"
        inputMode="decimal"
        value={formatPercentInput(value)}
        onChange={(e) => onChange(parseBrNumber(e.target.value))}
        style={baseInputStyle()}
      />
    </label>
  );
}

function InputInteger({ label, value, onChange }) {
  return (
    <label style={{ fontSize: 14, color: COLORS.text, display: "block" }}>
      <div style={{ marginBottom: 2 }}>{label}</div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={baseInputStyle()}
      />
    </label>
  );
}

function InputSelect({ label, value, onChange, options }) {
  return (
    <label style={{ fontSize: 14, color: COLORS.text, display: "block" }}>
      <div style={{ marginBottom: 2 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={baseInputStyle()}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ title, value, accent }) {
  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 6px 20px rgba(20, 58, 99, 0.05)",
      }}
    >
      <div style={{ fontSize: 13, color: COLORS.muted }}>{title}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginTop: 8,
          color: accent || COLORS.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 22,
        padding: 22,
        boxShadow: "0 10px 30px rgba(20, 58, 99, 0.06)",
        marginBottom: 22,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 6 }}>{subtitle}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function thStyle(first = false) {
  return {
    padding: "16px 14px",
    textAlign: first ? "left" : "center",
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 700,
    borderBottom: `1px solid ${COLORS.border}`,
  };
}

function tdLabelStyle() {
  return {
    padding: "13px 14px",
    color: COLORS.text,
    fontSize: 14,
    borderBottom: `1px solid ${COLORS.border}`,
    width: "42%",
  };
}

function tdValueStyle(highlight = false) {
  return {
    padding: "13px 14px",
    color: COLORS.text,
    fontSize: 14,
    borderBottom: `1px solid ${COLORS.border}`,
    textAlign: "left",
    background: highlight ? COLORS.positive : "transparent",
    fontWeight: highlight ? 700 : 400,
    whiteSpace: "nowrap",
  };
}

function ChartBox({ children }) {
  return (
    <div
      style={{
        width: "100%",
        height: 360,
        background: "#fff",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: 14,
      }}
    >
      {children}
    </div>
  );
}

function calcSac(principal, rate, months, trRate = 0) {
  if (principal <= 0 || months <= 0) return [];

  const amort = principal / months;
  let balance = principal;
  let cumulative = 0;
  const data = [];

  for (let m = 1; m <= months; m++) {
    const trAdjustment = balance * trRate;
    const interest = balance * rate;
    const installment = amort + interest + trAdjustment;

    cumulative += installment;
    balance = Math.max(balance + trAdjustment - amort, 0);

    data.push({
      month: m,
      installment,
      interest,
      trAdjustment,
      amort,
      balance,
      cumulative,
    });
  }

  return data;
}

function calcPrice(principal, rate, months, trRate = 0) {
  if (principal <= 0 || months <= 0) return [];

  let balance = principal;
  let cumulative = 0;
  const data = [];

  for (let m = 1; m <= months; m++) {
    const remainingMonths = months - m + 1;
    const updatedBalance = balance * (1 + trRate);
    const installment = pmt(updatedBalance, rate, remainingMonths);
    const interest = updatedBalance * rate;
    const trAdjustment = balance * trRate;
    const amort = Math.max(installment - interest, 0);

    balance = Math.max(updatedBalance - amort, 0);
    cumulative += installment;

    data.push({
      month: m,
      installment,
      interest,
      trAdjustment,
      amort,
      balance,
      cumulative,
    });
  }

  return data;
}

/**
 * Lógica final alinhada com o que você definiu:
 * - a contemplação NÃO altera o fluxo das parcelas
 * - a carta atualiza até a contemplação e depois trava
 * - as parcelas seguem iguais independentemente da contemplação
 * - sem lance: custo total do contrato não muda com o mês da contemplação
 * - com lance próprio: o custo total muda pelo desembolso do lance
 * - lance embutido não altera desembolso, só reduz crédito líquido
 */
function calcConsorcio(
  cartaCredito,
  months,
  adminPct,
  indexRate = 0,
  contemplationMonth = 1,
  bidValue = 0,
  bidType = "proprio"
) {
  if (cartaCredito <= 0 || months <= 0) return [];

  const ownBid = bidType === "proprio" ? Math.max(Number(bidValue) || 0, 0) : 0;
  const embeddedBid = bidType === "embutido" ? Math.max(Number(bidValue) || 0, 0) : 0;

  const grossOriginal = cartaCredito * (1 + adminPct);
  const parcelaBase = grossOriginal / months;

  let cumulative = 0;
  let cumulativeIndexAdjustment = 0;
  let cartaContemplada = null;
  let creditoLiquido = 0;

  const data = [];

  for (let m = 1; m <= months; m++) {
    const fator = (1 + indexRate) ** (m - 1);
    const cartaAtual = cartaCredito * fator;

    const installmentWithoutIndex = parcelaBase;
    const installment = parcelaBase * fator;
    const indexAdjustmentMonth = installment - installmentWithoutIndex;

    let bidPaidThisMonth = 0;

    if (m === contemplationMonth) {
      cartaContemplada = cartaAtual;
      creditoLiquido = Math.max(cartaContemplada - embeddedBid, 0);

      if (ownBid > 0) {
        bidPaidThisMonth = ownBid;
      }
    }

    cumulative += installment + bidPaidThisMonth;
    cumulativeIndexAdjustment += indexAdjustmentMonth;

    const grossAtual = grossOriginal * fator;
    const balance = Math.max(grossAtual - cumulative, 0);

    data.push({
      month: m,
      installment,
      installmentWithoutIndex,
      indexAdjustmentMonth,
      cumulativeIndexAdjustment,
      cumulative,
      carta: cartaContemplada ?? cartaAtual,
      balance,
      contemplado: m >= contemplationMonth,
      bidPaidThisMonth,
      bidType,
      ownBid,
      embeddedBid,
      availableCredit: creditoLiquido,
      cartaContemplada,
    });
  }

  return data;
}

export default function App() {
  const [propertyValue, setPropertyValue] = useState(500000);
  const [downPayment, setDownPayment] = useState(100000);
  const [consorcioCartaCredito, setConsorcioCartaCredito] = useState(500000);

  const [rateAnnual, setRateAnnual] = useState(11);
  const [trAnnual, setTrAnnual] = useState(1);
  const [monthsFinance, setMonthsFinance] = useState(200);

  const [monthsConsorcio, setMonthsConsorcio] = useState(200);
  const [adminFee, setAdminFee] = useState(20);
  const [indexadorAnnual, setIndexadorAnnual] = useState(6);
  const [contemplationMonth, setContemplationMonth] = useState(80);

  const [bidValue, setBidValue] = useState(0);
  const [bidType, setBidType] = useState("proprio");

  const financePrincipal = Math.max(
    (Number(propertyValue) || 0) - (Number(downPayment) || 0),
    0
  );
  const consorcioPrincipal = Math.max(Number(consorcioCartaCredito) || 0, 0);

  const monthlyRate = annualToMonthly(rateAnnual);
  const trMonthly = annualToMonthly(trAnnual);
  const indexadorMonthly = annualToMonthly(indexadorAnnual);

  const contemplationMonthSafe = Math.min(
    Math.max(Number(contemplationMonth) || 1, 1),
    Math.max(Number(monthsConsorcio) || 1, 1)
  );

  const sac = useMemo(
    () => calcSac(financePrincipal, monthlyRate, Number(monthsFinance) || 0, trMonthly),
    [financePrincipal, monthlyRate, monthsFinance, trMonthly]
  );

  const price = useMemo(
    () => calcPrice(financePrincipal, monthlyRate, Number(monthsFinance) || 0, trMonthly),
    [financePrincipal, monthlyRate, monthsFinance, trMonthly]
  );

  const consorcio = useMemo(
    () =>
      calcConsorcio(
        consorcioPrincipal,
        Number(monthsConsorcio) || 0,
        (Number(adminFee) || 0) / 100,
        indexadorMonthly,
        contemplationMonthSafe,
        Number(bidValue) || 0,
        bidType
      ),
    [
      consorcioPrincipal,
      monthsConsorcio,
      adminFee,
      indexadorMonthly,
      contemplationMonthSafe,
      bidValue,
      bidType,
    ]
  );

  const sacTotal = sac.length ? sac[sac.length - 1].cumulative : 0;
  const priceTotal = price.length ? price[price.length - 1].cumulative : 0;
  const consorcioTotal = consorcio.length ? consorcio[consorcio.length - 1].cumulative : 0;

  const sacInterest = sum(sac, "interest");
  const sacTR = sum(sac, "trAdjustment");

  const priceInterest = sum(price, "interest");
  const priceTR = sum(price, "trAdjustment");

  const sacInstallment = sac[0]?.installment || 0;
  const priceInstallment = price[0]?.installment || 0;
  const consorcioInstallment = consorcio[0]?.installment || 0;

  const sacFinalInstallment = sac[sac.length - 1]?.installment || 0;
  const priceFinalInstallment = price[price.length - 1]?.installment || 0;
  const consorcioFinalInstallment = consorcio[consorcio.length - 1]?.installment || 0;

  const cartaContratada = consorcioPrincipal;
  const creditoLiquidoContemplacao =
    consorcio[contemplationMonthSafe - 1]?.availableCredit || 0;

  const taxaAdministracaoConsorcio = cartaContratada * ((Number(adminFee) || 0) / 100);
  const custoIndexadorConsorcio = sum(consorcio, "indexAdjustmentMonth");

  const ownBidCash = bidType === "proprio" ? Number(bidValue) || 0 : 0;
  const embeddedBidValue = bidType === "embutido" ? Number(bidValue) || 0 : 0;

  const maxMonths = Math.max(sac.length, price.length, consorcio.length);

  const chartData = Array.from({ length: maxMonths }, (_, i) => ({
    month: i + 1,
    sac: sac[i]?.installment || null,
    price: price[i]?.installment || null,
    consorcio: consorcio[i]?.installment || null,
    sacBalance: sac[i]?.balance ?? null,
    priceBalance: price[i]?.balance ?? null,
    consorcioBalance: consorcio[i]?.balance ?? null,
    sacCum: sac[i]?.cumulative || null,
    priceCum: price[i]?.cumulative || null,
    consorcioCum: consorcio[i]?.cumulative || null,
  }));

  const menorParcela = bestOf(
    [
      { label: "SAC", value: sacInstallment },
      { label: "Price", value: priceInstallment },
      { label: "Consórcio", value: consorcioInstallment },
    ],
    "min"
  );

  const menorDesembolsoContratual = bestOf(
    [
      { label: "SAC", value: sacTotal + downPayment },
      { label: "Price", value: priceTotal + downPayment },
      { label: "Consórcio", value: consorcioTotal },
    ],
    "min"
  );

  const summaryRows = [
    {
      label: "Parcela inicial",
      sac: sacInstallment,
      price: priceInstallment,
      consorcio: consorcioInstallment,
      type: "currency",
      highlightValue: Math.min(sacInstallment, priceInstallment, consorcioInstallment),
    },
    {
      label: "Parcela final",
      sac: sacFinalInstallment,
      price: priceFinalInstallment,
      consorcio: consorcioFinalInstallment,
      type: "currency",
    },
    {
      label: "Juros",
      sac: sacInterest,
      price: priceInterest,
      consorcio: "-",
      type: "mixed",
    },
    {
      label: "Atualização TR / Indexador",
      sac: sacTR,
      price: priceTR,
      consorcio: custoIndexadorConsorcio,
      type: "currency",
    },
    {
      label: "Taxa de administração",
      sac: "-",
      price: "-",
      consorcio: taxaAdministracaoConsorcio,
      type: "mixed",
    },
    {
      label: "Entrada / lance próprio",
      sac: downPayment,
      price: downPayment,
      consorcio: ownBidCash,
      type: "currency",
    },
    {
      label: "Lance embutido",
      sac: "-",
      price: "-",
      consorcio: embeddedBidValue,
      type: "mixed",
    },
    {
      label: "Crédito líquido na contemplação",
      sac: propertyValue,
      price: propertyValue,
      consorcio: creditoLiquidoContemplacao,
      type: "currency",
    },
    {
      label: "Desembolso total contratual",
      sac: sacTotal + downPayment,
      price: priceTotal + downPayment,
      consorcio: consorcioTotal,
      type: "currency",
      highlightValue: Math.min(sacTotal + downPayment, priceTotal + downPayment, consorcioTotal),
    },
    {
      label: "Tempo até acesso ao crédito / imóvel",
      sac: "Imediato",
      price: "Imediato",
      consorcio: `${contemplationMonthSafe} meses`,
      type: "text",
    },
    {
      label: "TR anual / Indexador anual",
      sac: percent(trAnnual),
      price: percent(trAnnual),
      consorcio: percent(indexadorAnnual),
      type: "text",
    },
  ];

  const renderCell = (value, type) => {
    if (type === "text") return value;
    if (type === "mixed") return typeof value === "number" ? currency(value) : value;
    return currency(value);
  };

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "Arial, sans-serif",
        background: COLORS.bg,
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: 1380, margin: "0 auto" }}>
        <SectionCard
          title="Comparador: Financiamento vs Consórcio"
          subtitle="Foco no custo total do contrato. Sem lance, a contemplação altera o crédito líquido, mas não altera o fluxo contratual das parcelas."
        >
          <h2 style={{ fontSize: 20, color: COLORS.text, marginTop: 0 }}>Inputs</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <InputMoney label="Valor do imóvel" value={propertyValue} onChange={setPropertyValue} />
            <InputMoney label="Entrada financiamento" value={downPayment} onChange={setDownPayment} />
            <InputMoney
              label="Carta de crédito do consórcio"
              value={consorcioCartaCredito}
              onChange={setConsorcioCartaCredito}
            />
            <InputPercent
              label="Juros anual financiamento"
              value={rateAnnual}
              onChange={setRateAnnual}
            />
            <InputPercent label="TR anual" value={trAnnual} onChange={setTrAnnual} />
            <InputInteger
              label="Prazo financiamento (meses)"
              value={monthsFinance}
              onChange={setMonthsFinance}
            />
            <InputInteger
              label="Prazo consórcio (meses)"
              value={monthsConsorcio}
              onChange={setMonthsConsorcio}
            />
            <InputPercent
              label="Taxa administração consórcio"
              value={adminFee}
              onChange={setAdminFee}
            />
            <InputPercent
              label="Indexador anual do consórcio"
              value={indexadorAnnual}
              onChange={setIndexadorAnnual}
            />
            <InputInteger
              label="Mês de contemplação"
              value={contemplationMonth}
              onChange={setContemplationMonth}
            />
            <InputMoney label="Valor do lance" value={bidValue} onChange={setBidValue} />
            <InputSelect
              label="Tipo de lance"
              value={bidType}
              onChange={setBidType}
              options={[
                { value: "proprio", label: "Lance próprio" },
                { value: "embutido", label: "Lance embutido" },
              ]}
            />
          </div>
        </SectionCard>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <MetricCard
            title="Menor parcela inicial"
            value={menorParcela}
            accent={COLORS.consorcio}
          />
          <MetricCard
            title="Menor desembolso total contratual"
            value={menorDesembolsoContratual}
            accent={COLORS.sac}
          />
          <MetricCard
            title="Crédito líquido na contemplação"
            value={currency(creditoLiquidoContemplacao)}
            accent={COLORS.consorcio}
          />
        </div>

        <SectionCard title="Resumo comparativo">
          <div style={{ overflowX: "auto" }}>
            <table
              cellPadding="0"
              style={{
                borderCollapse: "separate",
                borderSpacing: 0,
                width: "100%",
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <thead>
                <tr style={{ background: COLORS.soft }}>
                  <th style={thStyle(true)}></th>
                  <th style={thStyle()}>SAC</th>
                  <th style={thStyle()}>PRICE</th>
                  <th style={thStyle()}>CONSÓRCIO</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, index) => (
                  <tr key={row.label} style={{ background: index % 2 === 0 ? "#fff" : "#fbfdff" }}>
                    <td style={tdLabelStyle()}>{row.label}</td>
                    <td style={tdValueStyle(row.highlightValue !== undefined && row.sac === row.highlightValue)}>
                      {renderCell(row.sac, row.type)}
                    </td>
                    <td style={tdValueStyle(row.highlightValue !== undefined && row.price === row.highlightValue)}>
                      {renderCell(row.price, row.type)}
                    </td>
                    <td style={tdValueStyle(row.highlightValue !== undefined && row.consorcio === row.highlightValue)}>
                      {renderCell(row.consorcio, row.type)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Leitura do consórcio">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <MetricCard
              title="Carta contratada"
              value={currency(cartaContratada)}
              accent={COLORS.consorcio}
            />
            <MetricCard
              title="Crédito líquido na contemplação"
              value={currency(creditoLiquidoContemplacao)}
              accent={COLORS.consorcio}
            />
            <MetricCard
              title="Taxa de administração"
              value={currency(taxaAdministracaoConsorcio)}
              accent={COLORS.text}
            />
            <MetricCard
              title="Custo do indexador"
              value={currency(custoIndexadorConsorcio)}
              accent={COLORS.text}
            />
            <MetricCard
              title="Tempo até contemplação"
              value={`${contemplationMonthSafe} meses`}
              accent={COLORS.text}
            />
            <MetricCard
              title="Lance próprio desembolsado"
              value={currency(ownBidCash)}
              accent={COLORS.text}
            />
          </div>
        </SectionCard>

        <SectionCard title="Parcelas">
          <ChartBox>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe8f2" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => currency(v)} />
                <Legend />
                <ReferenceLine
                  x={contemplationMonthSafe}
                  stroke={COLORS.marker}
                  strokeDasharray="5 5"
                  label="Contemplação"
                />
                <Line
                  type="monotone"
                  dataKey="consorcio"
                  name="Consórcio"
                  stroke={COLORS.consorcio}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  name="Price"
                  stroke={COLORS.price}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="sac"
                  name="SAC"
                  stroke={COLORS.sac}
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </SectionCard>

        <SectionCard title="Saldo devedor / obrigação remanescente">
          <ChartBox>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe8f2" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => currency(v)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sacBalance"
                  name="Saldo SAC"
                  stroke={COLORS.sac}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="priceBalance"
                  name="Saldo Price"
                  stroke={COLORS.price}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="consorcioBalance"
                  name="Obrigação Consórcio"
                  stroke={COLORS.consorcio}
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </SectionCard>

        <SectionCard title="Custo acumulado contratual">
          <ChartBox>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe8f2" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => currency(v)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sacCum"
                  name="SAC"
                  stroke={COLORS.sac}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="priceCum"
                  name="Price"
                  stroke={COLORS.price}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="consorcioCum"
                  name="Consórcio"
                  stroke={COLORS.consorcio}
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </SectionCard>

        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 18,
            padding: 18,
            color: COLORS.muted,
            fontSize: 14,
            lineHeight: 1.7,
            boxShadow: "0 8px 24px rgba(20, 58, 99, 0.05)",
          }}
        >
          <strong style={{ color: COLORS.text }}>Observações da modelagem:</strong>
          <div style={{ marginTop: 8 }}>
            1. Esta versão compara apenas o custo total do contrato, sem aluguel, valorização do imóvel
            ou outras opcionalidades do ativo.
          </div>
          <div>
            2. No financiamento, o desembolso total contratual considera entrada + soma das parcelas.
          </div>
          <div>
            3. No consórcio, o desembolso total contratual considera parcelas + eventual lance próprio.
          </div>
          <div>
            4. Sem lance, o mês da contemplação altera o crédito líquido recebido, mas não altera o fluxo contratual das parcelas.
          </div>
          <div>
            5. Lance embutido não entra como desembolso, mas reduz o crédito líquido disponível na contemplação.
          </div>
        </div>
      </div>
    </div>
  );
}
