import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

// ─── FONTS ──────────────────────────────────────────────── v2.1 ──────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

const styleEl = document.createElement("style");
styleEl.textContent = `
  * { box-sizing: border-box; }
  @media (max-width: 700px) {
    .sim-inputs { grid-template-columns: 1fr !important; }
    .sim-destaques { grid-template-columns: 1fr !important; }
    .sim-main { padding: 16px 12px !important; }
    .sim-header { padding: 12px 16px !important; }
    .sim-header-title { font-size: 17px !important; }
    .sim-header-sub { font-size: 11px !important; }
    .sim-hl-cols { flex-direction: column !important; }
  }
  .sim-number { transition: color 0.3s ease; }
  .sim-card { transition: box-shadow 0.2s ease; }
  .sim-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important; }
`;
document.head.appendChild(styleEl);

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#f7f9f7", panel:"#ffffff", border:"#e4ede4", borderMid:"#c8dcc8",
  text:"#1a2e1a", muted:"#6b7f6b", soft:"#f0f6f0",
  sac:"#1d6fa4", price:"#c2651a", cons:"#1e7a3e",
  accent:"#2d9e50", accentBg:"#edf7f0", accentHl:"#d1f0db",
  goldBg:"#fdf8ec",
};
const F = { display:"'Fraunces', Georgia, serif", body:"'DM Sans', system-ui, sans-serif" };

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const brl = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)||0);
const fmtCurrency = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2}).format(Number(v)||0);
const parseDigits = (v) => Number(String(v||"").replace(/\D/g,"")||"0")/100;
const parsePct = (v) => {
  if (typeof v==="number") return Number.isFinite(v)?v:0;
  const n=Number(String(v).replace(/\s/g,"").replace(/%/g,"").replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""));
  return Number.isFinite(n)?n:0;
};
const fmtPct = (v) => `${(Number(v)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
const annualToMonthly = (a) => (1+(Number(a)||0)/100)**(1/12)-1;
const pmtFn = (pv,r,n) => { if(n<=0)return 0; if(Math.abs(r)<1e-12)return pv/n; return pv*(r*(1+r)**n)/((1+r)**n-1); };

// ─── CALC: SAC ────────────────────────────────────────────────────────────────
function calcSac(principal,rM,trM,months) {
  if(principal<=0||months<=0) return {rows:[],totals:{}};
  let bal=principal,cumInstall=0,cumInterest=0,cumTR=0,cumAmort=0;
  const rows=Array.from({length:months},(_,i)=>{
    const remaining=months-i;
    const tr=bal*trM; bal+=tr;
    const amort=bal/remaining;
    const interest=bal*rM;
    const installment=amort+interest;
    bal=Math.max(bal-amort,0);
    cumInstall+=installment; cumInterest+=interest; cumTR+=tr; cumAmort+=amort;
    return {month:i+1,installment,interest,tr,amort,bal,cumInstall,cumInterest,cumTR,cumAmort};
  });
  const last=rows[rows.length-1];
  return {rows,totals:{installFirst:rows[0].installment,installLast:last.installment,totalInterest:last.cumInterest,totalTR:last.cumTR,totalAmort:principal,totalPaid:last.cumInstall}};
}

// ─── CALC: PRICE ──────────────────────────────────────────────────────────────
function calcPrice(principal,rM,trM,months) {
  if(principal<=0||months<=0) return {rows:[],totals:{}};
  let bal=principal,cumInstall=0,cumInterest=0,cumTR=0,cumAmort=0;
  const rows=Array.from({length:months},(_,i)=>{
    const remaining=months-i; const tr=bal*trM; bal+=tr;
    const installment=pmtFn(bal,rM,remaining); const interest=bal*rM;
    const amort=Math.max(installment-interest,0); bal=Math.max(bal-amort,0);
    cumInstall+=installment; cumInterest+=interest; cumTR+=tr; cumAmort+=amort;
    return {month:i+1,installment,interest,tr,amort,bal,cumInstall,cumInterest,cumTR,cumAmort};
  });
  const last=rows[rows.length-1];
  return {rows,totals:{installFirst:rows[0].installment,installLast:last.installment,totalInterest:last.cumInterest,totalTR:last.cumTR,totalAmort:principal,totalPaid:last.cumInstall}};
}

// ─── CALC: SAC COM AMORTIZAÇÃO EXTRAORDINÁRIA ─────────────────────────────────
// PRAZO: parcela original mantida. Amort extra reduz saldo → encerra antes.
//        Você paga mesma parcela por menos meses → menos juros.
// PARCELA: parcela recalculada sobre saldo menor e mesmo prazo → parcela cai.
//          Você paga parcelas menores pelo mesmo prazo → mais juros que prazo.
function calcSacAmort(principal,rM,trM,months,amortMensal,amortAnual,mesAnual,efeito) {
  if(principal<=0||months<=0) return {rows:[],totals:{}};

  // Pré-calcula parcelas originais (sem amort extra) para modo prazo
  const instOriginais=[];
  if(efeito==="prazo"){
    let b2=principal;
    for(let i=0;i<months;i++){
      const rem=months-i;
      const tr=b2*trM; b2+=tr;
      const amort=b2/rem;
      const interest=b2*rM;
      instOriginais.push(amort+interest);
      b2=Math.max(b2-amort,0);
    }
  }

  let bal=principal,cumInstall=0,cumInterest=0,cumTR=0,cumAmortExtra=0;
  const rows=[];

  for(let i=0;i<months;i++){
    const m=i+1, rem=months-i;
    if(bal<0.01){
      if(efeito==="prazo") break;
      rows.push({month:m,installment:0,interest:0,tr:0,amort:0,amortExtra:0,bal:0,cumInstall,cumInterest,cumTR,cumAmortExtra});
      continue;
    }
    const tr=bal*trM; bal+=tr;
    const interest=bal*rM;
    let inst, amort;
    if(efeito==="prazo"){
      // Mantém parcela original — amortiza mais quando saldo está menor
      inst=instOriginais[i]||0;
      amort=Math.max(inst-interest,0);
    } else {
      // Recalcula parcela sobre saldo atual e prazo nominal
      amort=bal/rem;
      inst=amort+interest;
    }
    bal=Math.max(bal-amort,0);
    cumInstall+=inst; cumInterest+=interest; cumTR+=tr;
    const mNorm=m%12===0?12:m%12;
    const mesNorm=(mesAnual||12)%12===0?12:(mesAnual||12)%12;
    const isAnual=amortAnual>0&&mNorm===mesNorm;
    const extra=Math.min((amortMensal||0)+(isAnual?(amortAnual||0):0),bal);
    bal=Math.max(bal-extra,0);
    cumAmortExtra+=extra;
    rows.push({month:m,installment:inst,interest,tr,amort,amortExtra:extra,bal,cumInstall,cumInterest,cumTR,cumAmortExtra});
    if(efeito==="prazo"&&bal<0.01) break;
  }

  const last=rows[rows.length-1]||{};
  const validRows=rows.filter(r=>r.installment>0.01);
  const prazoEfetivo=validRows.length;
  return {rows,totals:{
    installFirst:rows[0]?.installment||0,
    installLast:validRows[validRows.length-1]?.installment||0,
    totalInterest:last.cumInterest||0,
    totalTR:last.cumTR||0,
    totalAmort:principal,
    totalPaid:(last.cumInstall||0)+(last.cumAmortExtra||0),
    totalAmortExtra:last.cumAmortExtra||0,
    prazoEfetivo,
    mesesEconomizados:months-prazoEfetivo,
  }};
}

// ─── CALC: PRICE COM AMORTIZAÇÃO EXTRAORDINÁRIA ───────────────────────────────
// PRAZO: PMT original mantido. Amort extra → encerra antes.
// PARCELA: PMT recalculado sobre saldo menor e mesmo prazo → parcela cai.
function calcPriceAmort(principal,rM,trM,months,amortMensal,amortAnual,mesAnual,efeito) {
  if(principal<=0||months<=0) return {rows:[],totals:{}};

  // Pré-calcula PMTs originais para modo prazo
  const instOriginais=[];
  if(efeito==="prazo"){
    let b2=principal;
    for(let i=0;i<months;i++){
      const rem=months-i;
      const tr=b2*trM; b2+=tr;
      const inst=pmtFn(b2,rM,rem);
      const amort=Math.max(inst-b2*rM,0);
      instOriginais.push(inst);
      b2=Math.max(b2-amort,0);
    }
  }

  let bal=principal,cumInstall=0,cumInterest=0,cumTR=0,cumAmortExtra=0;
  const rows=[];

  for(let i=0;i<months;i++){
    const m=i+1, rem=months-i;
    if(bal<0.01){
      if(efeito==="prazo") break;
      rows.push({month:m,installment:0,interest:0,tr:0,amort:0,amortExtra:0,bal:0,cumInstall,cumInterest,cumTR,cumAmortExtra});
      continue;
    }
    const tr=bal*trM; bal+=tr;
    const interest=bal*rM;
    let inst, amort;
    if(efeito==="prazo"){
      inst=instOriginais[i]||0;
      amort=Math.max(inst-interest,0);
    } else {
      inst=bal>0?pmtFn(bal,rM,rem):0;
      amort=Math.max(inst-interest,0);
    }
    bal=Math.max(bal-amort,0);
    cumInstall+=inst; cumInterest+=interest; cumTR+=tr;
    const mNorm=m%12===0?12:m%12;
    const mesNorm=(mesAnual||12)%12===0?12:(mesAnual||12)%12;
    const isAnual=amortAnual>0&&mNorm===mesNorm;
    const extra=Math.min((amortMensal||0)+(isAnual?(amortAnual||0):0),bal);
    bal=Math.max(bal-extra,0);
    cumAmortExtra+=extra;
    rows.push({month:m,installment:inst,interest,tr,amort,amortExtra:extra,bal,cumInstall,cumInterest,cumTR,cumAmortExtra});
    if(efeito==="prazo"&&bal<0.01) break;
  }

  const last=rows[rows.length-1]||{};
  const validRows=rows.filter(r=>r.installment>0.01);
  const prazoEfetivo=validRows.length;
  return {rows,totals:{
    installFirst:rows[0]?.installment||0,
    installLast:validRows[validRows.length-1]?.installment||0,
    totalInterest:last.cumInterest||0,
    totalTR:last.cumTR||0,
    totalAmort:principal,
    totalPaid:(last.cumInstall||0)+(last.cumAmortExtra||0),
    totalAmortExtra:last.cumAmortExtra||0,
    prazoEfetivo,
    mesesEconomizados:months-prazoEfetivo,
  }};
}

// ─── CALC: CONSÓRCIO ──────────────────────────────────────────────────────────
/**
 * Sem promoção:
 *   parcela(m) = parcelaBase × fatorIdx(m) — linha contínua
 *
 * Com promoção que encerra ANTES da contemplação (promoMeses < cm):
 *   1..promoMeses: parcela reduzida
 *   No mês promoMeses+1: recalcula saldo devedor (meias não pagas + restante)
 *                        → salto para cima
 *   promoMeses+1..cm: nova parcela recalculada × fatorIdx relativo
 *   cm em diante: sem salto — já foi recalculado quando promo encerrou
 *
 * Com promoção até a contemplação (promoMeses >= cm):
 *   1..cm: parcela reduzida
 *   Na contemplação: recalcula saldo → salto para cima
 *   cm+1 em diante: nova parcela × fatorIdx
 *
 * Com lance: saldo menor na contemplação → parcela pós menor → salto para baixo
 */
function calcConsorcio(carta,months,adminPct,fundoReservaPct,idxM,cm,lance,promoDescPct=0,promoMeses=0) {
  if(carta<=0||months<=0) return {rows:[],totals:{},meta:{}};

  const lanceSafe=Math.max(Number(lance)||0,0);
  const fundoCost=carta*fundoReservaPct;
  const grossTotal=carta*(1+adminPct+fundoReservaPct);
  const parcelaBase=grossTotal/months;
  const adminCost=carta*adminPct;
  const promoM=Math.min(Math.max(Math.round(promoMeses)||0,0),months-1);
  const promoD=Math.max(promoDescPct||0,0);
  const fatorCm=(1+idxM)**(cm-1);
  const cartaTravada=carta*fatorCm;

  // Momento do recálculo:
  // - promoM < cm: recalcula no mês promoM+1
  // - promoM >= cm: recalcula na contemplação (cm)
  const recalcMes=promoD>0?(promoM<cm?promoM+1:cm):null;

  // Simula saldo devedor mês a mês para encontrar saldo no momento do recálculo
  let saldoNoRecalc=0;
  if(recalcMes!==null){
    let s=grossTotal;
    for(let m=1;m<recalcMes;m++){
      s=s*(1+idxM);
      const p=parcelaBase*(1+idxM)**(m-1);
      s=Math.max(s-p*( m<=promoM?( 1-promoD):1),0);
    }
    // Atualiza pelo indexador do mês do recálculo
    s=s*(1+idxM);
    saldoNoRecalc=s;
  }

  // Parcela recalculada no momento do recálculo
  // meses restantes a partir do recalcMes
  const mesesAposRecalc=recalcMes!==null?months-recalcMes+1:0;
  const parcelaRecalcBase=recalcMes!==null&&mesesAposRecalc>0
    ?saldoNoRecalc/mesesAposRecalc
    :0;

  // Lance efetivo — calculado sobre saldo na contemplação
  let saldoNaCm=0;
  if(recalcMes!==null&&promoM>=cm){
    // promoção até contemplação: saldo na contemplação = saldoNoRecalc
    saldoNaCm=saldoNoRecalc;
  } else if(recalcMes!==null&&promoM<cm){
    // recálculo antes de cm: saldo na contemplação = parcelaRecalcBase × meses restantes
    const mesesAteContemplacao=cm-recalcMes;
    // saldo = parcelaRecalcBase × (meses após recálculo - meses já pagos após recálculo)
    // simplificação: saldo = parcelaRecalcBase × (months - cm)
    saldoNaCm=parcelaRecalcBase*(months-cm);
  } else {
    // sem promoção: lógica original
    saldoNaCm=Math.max(grossTotal*fatorCm-parcelaBase*fatorCm*cm,0);
  }
  const lanceEfetivo=Math.min(lanceSafe,saldoNaCm);
  const saldoPos=Math.max(saldoNaCm-lanceEfetivo,0);
  const mesesPos=months-cm;

  // Base pós-contemplação
  // Com lance: recalcula sobre saldo menor
  // Sem lance: continua da parcela recalculada (ou linha original se sem promoção)
  let parcelaPosBase;
  if(lanceSafe>0&&mesesPos>0){
    parcelaPosBase=saldoPos/mesesPos;
  } else if(promoD>0){
    // continua da parcelaRecalcBase reajustada até cm
    const mesesDesdeRecalc=cm-recalcMes;
    parcelaPosBase=parcelaRecalcBase*(1+idxM)**mesesDesdeRecalc;
  } else {
    parcelaPosBase=parcelaBase*(1+idxM)**(cm-1);
  }

  let idxPre=0,idxPos=0,cumInstall=0;

  const rows=Array.from({length:months},(_,i)=>{
    const m=i+1;
    let installment,parcelaBase_m,idxAdj;

    if(m<=cm){
      if(promoD>0&&m<recalcMes){
        parcelaBase_m=parcelaBase*(1+idxM)**(m-1);
        installment=parcelaBase_m*(1-promoD);
      } else if(promoD>0&&m>=recalcMes){
        parcelaBase_m=parcelaRecalcBase*(1+idxM)**(m-recalcMes);
        installment=parcelaBase_m;
      } else {
        parcelaBase_m=parcelaBase*(1+idxM)**(m-1);
        installment=parcelaBase_m;
      }
      // Custo do indexador pré = quanto a parcela cresceu acima da base original
      idxAdj=Math.max(installment-parcelaBase,0);
      idxPre+=idxAdj;
    } else {
      parcelaBase_m=parcelaPosBase*(1+idxM)**(m-cm);
      installment=parcelaBase_m;
      // Custo do indexador pós = quanto paga acima da parcelaBase original
      idxAdj=Math.max(installment-parcelaBase,0);
      idxPos+=idxAdj;
    }

    if(m===cm) cumInstall+=lanceEfetivo;
    cumInstall+=installment;
    return {month:m,installment,installmentBase:parcelaBase_m,idxAdj,cumInstall,isPos:m>cm};
  });

  const last=rows[rows.length-1];

  return {
    rows,
    totals:{
      installFirst:rows[0]?.installment||0,
      installLast:last?.installment||0,
      totalAdm:adminCost,
      totalFundo:fundoCost,
      totalIdxPre:idxPre,
      totalIdxPos:idxPos,
      totalPaid:last?.cumInstall||0,
      totalAmort:cartaTravada,
      cartaTravada,
      lanceEfetivo,
    },
    meta:{cartaTravada,lanceEfetivo,adminCost,fundoCost,idxPre,idxPos,cm,promoDescPct:promoD,promoMeses:promoM},
  };
}

// ─── INPUTS ───────────────────────────────────────────────────────────────────
const iBase={width:"100%",marginTop:5,padding:"12px 14px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,background:"#fff",boxSizing:"border-box",color:C.text,outline:"none",fontFamily:F.body,transition:"border-color 0.15s"};

function InputMoney({label,value,onChange,hint}) {
  const [d,setD]=useState(fmtCurrency(value));
  useEffect(()=>{setD(fmtCurrency(value));},[value]);
  return (
    <label style={{display:"block",fontFamily:F.body}}>
      <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
      <input type="text" inputMode="numeric" value={d}
        onChange={e=>{const n=parseDigits(e.target.value);setD(fmtCurrency(n));onChange(n);}}
        onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
        style={iBase}/>
      {hint&&<div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.4}}>{hint}</div>}
    </label>
  );
}
function InputPct({label,value,onChange,hint}) {
  return (
    <label style={{display:"block",fontFamily:F.body}}>
      <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
      <div style={{position:"relative"}}>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={e=>onChange(parseFloat(e.target.value)||0)}
          onFocus={e=>{e.target.style.borderColor=C.accent;e.target.select();}}
          onBlur={e=>e.target.style.borderColor=C.border}
          style={{...iBase,paddingRight:32}}/>
        <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.muted,pointerEvents:"none"}}>%</span>
      </div>
      {hint&&<div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.4}}>{hint}</div>}
    </label>
  );
}
function InputInt({label,value,onChange,hint}) {
  return (
    <label style={{display:"block",fontFamily:F.body}}>
      <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
      <input type="number" value={value}
        onChange={e=>onChange(Number(e.target.value))}
        onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
        style={iBase}/>
      {hint&&<div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.4}}>{hint}</div>}
    </label>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function InputPanel({accentColor,label,children}) {
  return (
    <div style={{background:C.panel,borderRadius:16,border:`1px solid ${C.border}`,boxShadow:"0 2px 12px rgba(0,0,0,0.04)",overflow:"hidden"}}>
      <div style={{background:accentColor,padding:"14px 22px"}}>
        <span style={{fontFamily:F.display,fontSize:18,fontWeight:700,color:"#fff",letterSpacing:"-0.01em"}}>{label}</span>
      </div>
      <div style={{padding:22,display:"flex",flexDirection:"column",gap:16}}>{children}</div>
    </div>
  );
}

function SectionHeader({label}) {
  return (
    <tr><td colSpan={4} style={{padding:"9px 18px",background:C.soft,fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.09em",borderBottom:`1px solid ${C.border}`,borderTop:`1px solid ${C.border}`,fontFamily:F.body}}>{label}</td></tr>
  );
}

function Row({label,sub,sac,price,cons,hlMin,even}) {
  const vals=[{v:sac,color:C.sac},{v:price,color:C.price},{v:cons,color:C.cons}];
  const nums=vals.map(x=>x.v).filter(v=>typeof v==="number");
  const minVal=hlMin&&nums.length?Math.min(...nums):null;
  const renderVal=({v,color})=>{
    if(v===null||v===undefined) return <span style={{color:C.border,fontSize:16}}>—</span>;
    if(typeof v==="string") return <span style={{color:C.text}}>{v}</span>;
    const isMin=hlMin&&v===minVal;
    return <span style={{fontWeight:isMin?700:400,color:isMin?color:C.text}}>{brl(v)}</span>;
  };
  return (
    <tr style={{background:even?"#fafcfa":"#fff"}}>
      <td style={{padding:"13px 18px",fontSize:14,color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:F.body,width:"34%"}}>
        <div style={{fontWeight:500}}>{label}</div>
        {sub&&<div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.4}}>{sub}</div>}
      </td>
      {vals.map((item,i)=>(
        <td key={i} style={{padding:"13px 18px",fontSize:14,textAlign:"center",borderBottom:`1px solid ${C.border}`,background:hlMin&&item.v===minVal?C.accentHl:"transparent",whiteSpace:"nowrap",fontFamily:F.body}}>
          {renderVal(item)}
        </td>
      ))}
    </tr>
  );
}

function ChartCard({title,subtitle,children}) {
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"22px 22px 14px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)",marginBottom:16}}>
      <div style={{fontFamily:F.display,fontSize:19,fontWeight:700,color:C.text,marginBottom:4}}>{title}</div>
      {subtitle&&<div style={{fontSize:12,color:C.muted,marginBottom:16,fontFamily:F.body,lineHeight:1.5}}>{subtitle}</div>}
      <div style={{width:"100%",height:300}}>{children}</div>
    </div>
  );
}

const CustomTooltip=({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",boxShadow:"0 4px 20px rgba(0,0,0,0.1)",fontFamily:F.body,fontSize:12}}>
      <div style={{fontWeight:600,color:C.muted,marginBottom:6}}>Mês {label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",gap:16,color:p.color,marginBottom:2}}>
          <span>{p.name}</span><span style={{fontWeight:600}}>{brl(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── HISTÓRICO COMPONENT ─────────────────────────────────────────────────────
function HistoricoTabela({sac,price,cons,cmSafe,carta,admin,fundo,prazoCons}) {
  const [open,setOpen]=useState(false);
  const [aba,setAba]=useState("SAC");
  const [modo,setModo]=useState("anual");

  const thS={padding:"9px 12px",fontSize:11,fontWeight:700,textAlign:"center",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.soft,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"};
  const tdC=(bold,color)=>({padding:"8px 12px",fontSize:12,textAlign:"right",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,fontWeight:bold?600:400,color:color||C.text,whiteSpace:"nowrap"});
  const tdL={padding:"8px 12px",fontSize:12,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,color:C.muted,whiteSpace:"nowrap"};

  const filterRows=(rows)=>modo==="anual"
    ?rows.filter(r=>r.month%12===0||r.month===1||r.month===(rows.length))
    :rows;

  const sacRows=filterRows(sac.rows||[]);
  const priceRows=filterRows(price.rows||[]);
  const consRows=filterRows(cons.rows||[]);
  const abas=[{id:"SAC",color:C.sac},{id:"Price",color:C.price},{id:"Consórcio",color:C.cons}];

  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 2px 12px rgba(0,0,0,0.04)",marginBottom:16,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontFamily:F.display,fontSize:17,fontWeight:700,color:C.text}}>Histórico detalhado de parcelas</span>
          <span style={{fontSize:12,color:C.muted}}>SAC · Price · Consórcio — amortização, juros e custos mês a mês</span>
        </div>
        <span style={{fontSize:18,color:C.muted,transition:"transform 0.2s",display:"block",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>

      {open&&(
        <div>
          <div style={{padding:"0 22px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:6}}>
              {abas.map(a=>(
                <button key={a.id} onClick={()=>setAba(a.id)} style={{padding:"6px 16px",borderRadius:8,border:`1.5px solid ${aba===a.id?a.color:C.border}`,background:aba===a.id?a.color:"#fff",color:aba===a.id?"#fff":C.muted,fontFamily:F.body,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
                  {a.id}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:6}}>
              {["anual","mensal"].map(m=>(
                <button key={m} onClick={()=>setModo(m)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${modo===m?C.accent:C.border}`,background:modo===m?C.accentBg:"#fff",color:modo===m?C.accent:C.muted,fontFamily:F.body,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
                  {m==="anual"?"A cada 12 meses":"Mensal completo"}
                </button>
              ))}
            </div>
          </div>

          {aba==="SAC"&&(
            <div style={{overflowX:"auto",maxHeight:420,overflowY:"auto"}}>
              <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:520}}>
                <thead style={{position:"sticky",top:0,zIndex:2}}>
                  <tr>
                    <th style={{...thS,textAlign:"center"}}>Mês</th>
                    <th style={thS}>Saldo devedor</th>
                    <th style={{...thS,color:C.sac}}>Amortização</th>
                    <th style={{...thS,color:C.sac}}>Juros</th>
                    <th style={thS}>TR</th>
                    <th style={{...thS,color:C.sac}}>Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {sacRows.map((r,i)=>(
                    <tr key={r.month} style={{background:i%2===0?"#fff":"#fafcfa"}}>
                      <td style={tdL}>{r.month}</td>
                      <td style={tdC()}>{brl(r.bal)}</td>
                      <td style={tdC(true,C.sac)}>{brl(r.amort)}</td>
                      <td style={tdC()}>{brl(r.interest)}</td>
                      <td style={tdC()}>{brl(r.tr)}</td>
                      <td style={tdC(true)}>{brl(r.installment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {aba==="Price"&&(
            <div style={{overflowX:"auto",maxHeight:420,overflowY:"auto"}}>
              <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:520}}>
                <thead style={{position:"sticky",top:0,zIndex:2}}>
                  <tr>
                    <th style={{...thS,textAlign:"center"}}>Mês</th>
                    <th style={thS}>Saldo devedor</th>
                    <th style={{...thS,color:C.price}}>Amortização</th>
                    <th style={{...thS,color:C.price}}>Juros</th>
                    <th style={thS}>TR</th>
                    <th style={{...thS,color:C.price}}>Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRows.map((r,i)=>(
                    <tr key={r.month} style={{background:i%2===0?"#fff":"#fafcfa"}}>
                      <td style={tdL}>{r.month}</td>
                      <td style={tdC()}>{brl(r.bal)}</td>
                      <td style={tdC(true,C.price)}>{brl(r.amort)}</td>
                      <td style={tdC()}>{brl(r.interest)}</td>
                      <td style={tdC()}>{brl(r.tr)}</td>
                      <td style={tdC(true)}>{brl(r.installment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {aba==="Consórcio"&&(
            <div style={{overflowX:"auto",maxHeight:420,overflowY:"auto"}}>
              <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:600}}>
                <thead style={{position:"sticky",top:0,zIndex:2}}>
                  <tr>
                    <th style={{...thS,textAlign:"center"}}>Mês</th>
                    <th style={{...thS,color:C.cons}}>Fundo comum</th>
                    <th style={{...thS,color:C.cons}}>Taxa de adm</th>
                    <th style={{...thS,color:C.cons}}>Fundo reserva</th>
                    <th style={thS}>Indexador</th>
                    <th style={{...thS,color:C.cons}}>Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {consRows.map((r,i)=>{
                    const grossBase=carta*(1+admin/100+fundo/100)/prazoCons;
                    const fatorM=grossBase>0?r.installmentBase/grossBase:1;
                    const fundoComum=(carta/prazoCons)*fatorM;
                    const taxaAdm=(carta*admin/100/prazoCons)*fatorM;
                    const fundoRes=(carta*fundo/100/prazoCons)*fatorM;
                    return (
                      <tr key={r.month} style={{background:i%2===0?"#fff":"#fafcfa"}}>
                        <td style={{...tdL,color:r.month>=cmSafe?C.accent:C.muted}}>{r.month}{r.month===cmSafe?" ★":""}</td>
                        <td style={tdC(true,C.cons)}>{brl(fundoComum)}</td>
                        <td style={tdC()}>{brl(taxaAdm)}</td>
                        <td style={tdC()}>{brl(fundoRes)}</td>
                        <td style={tdC()}>{brl(r.idxAdj)}</td>
                        <td style={tdC(true)}>{brl(r.installment)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── FLUXO DE CAIXA COMPONENT ────────────────────────────────────────────────
function FluxoCaixa({sac,price,cons,cmSafe,entrada,fgts,lance,aluguelPorMes,sacAmort,priceAmort,amortAtiva,amortMesAnual}) {
  const [open,setOpen]=useState(false);
  const [modo,setModo]=useState("anual");

  const maxM=Math.max(sac.rows.length,price.rows.length,cons.rows.length);

  // Meses a exibir
  const meses=useMemo(()=>{
    if(modo==="mensal") return Array.from({length:maxM},(_,i)=>i+1);
    // Anual: mês 1 + múltiplos de 12 + último mês
    const s=new Set([1]);
    for(let m=12;m<=maxM;m+=12) s.add(m);
    s.add(maxM);
    return [...s].sort((a,b)=>a-b);
  },[modo,maxM]);

  const thS={padding:"9px 12px",fontSize:11,fontWeight:700,textAlign:"right",
    color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.soft,
    fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"};
  const tdN=(v,bold,color,bg)=>({
    padding:"8px 12px",fontSize:12,textAlign:"right",
    borderBottom:`1px solid ${C.border}`,fontFamily:F.body,
    fontWeight:bold?700:400,color:color||C.text,
    whiteSpace:"nowrap",background:bg||"transparent"
  });
  const tdM={padding:"8px 12px",fontSize:12,textAlign:"center",
    borderBottom:`1px solid ${C.border}`,fontFamily:F.body,
    color:C.muted,whiteSpace:"nowrap",fontWeight:500};

  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,
      boxShadow:"0 2px 12px rgba(0,0,0,0.04)",marginBottom:16,overflow:"hidden"}}>

      {/* Header */}
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",
        border:"none",cursor:"pointer",padding:"16px 22px",display:"flex",
        alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontFamily:F.display,fontSize:17,fontWeight:700,color:C.text}}>
            Fluxo de caixa comparativo
          </span>
          <span style={{fontSize:12,color:C.muted}}>
            Parcela mensal lado a lado — SAC · Price · Consórcio
          </span>
        </div>
        <span style={{fontSize:18,color:C.muted,transition:"transform 0.2s",
          transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>

      {open&&(
        <div>
          {/* Controles */}
          <div style={{padding:"0 22px 14px",display:"flex",alignItems:"center",
            justifyContent:"space-between",flexWrap:"wrap",gap:10,
            borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:12,color:C.muted,fontFamily:F.body}}>
              Entradas destacadas em negrito · ★ = contemplação do consórcio
            </div>
            <div style={{display:"flex",gap:6}}>
              {["anual","mensal"].map(m=>(
                <button key={m} onClick={()=>setModo(m)} style={{
                  padding:"6px 14px",borderRadius:8,
                  border:`1.5px solid ${modo===m?C.accent:C.border}`,
                  background:modo===m?C.accentBg:"#fff",
                  color:modo===m?C.accent:C.muted,
                  fontFamily:F.body,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  {m==="anual"?"A cada 12 meses":"Mensal completo"}
                </button>
              ))}
            </div>
          </div>

          <div style={{overflowX:"auto",maxHeight:480,overflowY:"auto"}}>
            <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,
              width:"100%",minWidth:620}}>
              <thead style={{position:"sticky",top:0,zIndex:2}}>
                <tr>
                  <th style={{...thS,textAlign:"center",width:60}}>Mês</th>
                  <th style={{...thS,color:C.sac}}>SAC</th>
                  <th style={{...thS,color:C.price}}>Price</th>
                  <th style={{...thS,color:C.cons}}>Consórcio</th>
                  {amortAtiva&&<th style={{...thS,color:C.sac}}>Amort. Extra</th>}
                  <th style={{...thS}}>Menor</th>
                </tr>
              </thead>
              <tbody>
                {/* Linha de entrada/lance — mês 0 */}
                {(entrada>0||fgts>0||lance>0)&&(
                  <tr style={{background:C.accentBg}}>
                    <td style={{...tdM,color:C.accent,fontWeight:700}}>0</td>
                    <td style={tdN(entrada+fgts,true,C.sac,C.accentBg)}>
                      {entrada+fgts>0?<><strong>{brl(entrada+fgts)}</strong><br/><span style={{fontSize:10,color:C.muted}}>entrada{fgts>0?" + FGTS":""}</span></>:"—"}
                    </td>
                    <td style={tdN(entrada+fgts,true,C.price,C.accentBg)}>
                      {entrada+fgts>0?<><strong>{brl(entrada+fgts)}</strong><br/><span style={{fontSize:10,color:C.muted}}>entrada{fgts>0?" + FGTS":""}</span></>:"—"}
                    </td>
                    <td style={tdN(lance,true,C.cons,C.accentBg)}>
                      {lance>0?<><strong>{brl(lance)}</strong><br/><span style={{fontSize:10,color:C.muted}}>lance próprio</span></>:<span style={{color:C.muted}}>—</span>}
                    </td>
                    <td style={tdN(null,false,C.muted,C.accentBg)}>
                      <span style={{fontSize:10,color:C.muted}}>desembolso inicial</span>
                    </td>
                  </tr>
                )}

                {meses.map((m,i)=>{
                  const sr=sac.rows[m-1];
                  const pr=price.rows[m-1];
                  const cr=cons.rows[m-1];
                  const sv=sr?.installment??null;
                  const pv=pr?.installment??null;
                  // Consórcio: adiciona aluguel se pré-contemplação
                  const alug=m<=cmSafe?(aluguelPorMes[m-1]||0):0;
                  const cv=cr?(cr.installment+alug):null;
                  const nums=[sv,pv,cv].filter(v=>v!==null);
                  const minV=nums.length?Math.min(...nums):null;
                  const isContemplacao=m===cmSafe;
                  const rowBg=isContemplacao?C.accentBg:i%2===0?"#fff":"#fafcfa";

                  return (
                    <tr key={m} style={{background:rowBg}}>
                      <td style={{...tdM,color:isContemplacao?C.accent:C.muted,fontWeight:isContemplacao?700:500}}>
                        {m}{isContemplacao?" ★":""}
                      </td>
                      {[{v:sv,color:C.sac},{v:pv,color:C.price},{v:cv,color:C.cons,alug}].map((item,j)=>{
                        const isMin=item.v!==null&&item.v===minV;
                        return (
                          <td key={j} style={tdN(item.v,isMin,isMin?item.color:C.text,isMin?C.accentHl:rowBg)}>
                            {item.v===null
                              ?<span style={{color:C.border}}>—</span>
                              :<>
                                {brl(item.v)}
                                {item.alug>0&&<><br/><span style={{fontSize:10,color:C.muted}}>+{brl(item.alug)} aluguel</span></>}
                              </>
                            }
                          </td>
                        );
                      })}
                      <td style={{...tdN(null,false),textAlign:"center"}}>
                        {minV!==null&&(
                          <span style={{fontSize:11,fontWeight:700,
                            color:sv===minV?C.sac:pv===minV?C.price:C.cons}}>
                            {sv===minV?"SAC":pv===minV?"Price":"Consórcio"}
                          </span>
                        )}
                      </td>
                      {amortAtiva&&(()=>{
                        const sacEx=sacAmort?.rows[m-1]?.amortExtra||0;
                        const priceEx=priceAmort?.rows[m-1]?.amortExtra||0;
                        const extra=Math.max(sacEx,priceEx);
                        return (
                          <td style={tdN(extra,extra>0,extra>0?C.sac:C.muted,extra>0?"#eff6ff":rowBg)}>
                            {extra>0?<><strong>{brl(extra)}</strong><br/><span style={{fontSize:10,color:C.muted}}>amort. extra</span></>:<span style={{color:C.border}}>—</span>}
                          </td>
                        );
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CUSTOS DETALHADOS COMPONENT ─────────────────────────────────────────────
function CustosDetalhados({st,pt,ct,sacTotal,priceTotal,consTotal,principal,entrada,fgts,aluguelTotal,cmSafe}) {
  const [open,setOpen]=useState(false);

  const thS={padding:"10px 18px",fontSize:11,fontWeight:700,textAlign:"center",
    color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.soft,
    fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em"};

  const renderVal=(v,color,hlMin,minV)=>{
    if(v===null||v===undefined) return <span style={{color:C.border,fontSize:16}}>—</span>;
    if(typeof v==="string") return <span style={{color:C.text,fontSize:13}}>{v}</span>;
    const isMin=hlMin&&v===minV;
    return <span style={{fontWeight:isMin?700:400,color:isMin?color:C.text,fontSize:13}}>{brl(v)}</span>;
  };

  const rows=[
    {label:"Juros + seguros + taxas (CET)",sub:"Custo Efetivo Total contratado",sac:st.totalInterest,price:pt.totalInterest,cons:null,hlMin:true},
    {label:"TR paga",sac:st.totalTR,price:pt.totalTR,cons:null,hlMin:true},
    {label:"Taxa de administração",sac:null,price:null,cons:ct.totalAdm,hlMin:false},
    {label:"Fundo de reserva",sub:"Pode ser devolvido ao final",sac:null,price:null,cons:ct.totalFundo,hlMin:false},
    {label:"Indexador pré-contemplação",sub:"Carta e parcela crescem juntas",sac:null,price:null,cons:ct.totalIdxPre,hlMin:false},
    {label:"Indexador pós-contemplação",sub:"Carta travada, parcela ainda cresce",sac:null,price:null,cons:ct.totalIdxPos,hlMin:false},
    {label:"Aluguel durante espera",sub:aluguelTotal>0?`${cmSafe} meses · reajustado pelo indexador`:"Não informado",sac:null,price:null,cons:aluguelTotal>0?aluguelTotal:null,hlMin:false},
    {label:"Entrada / lance",sac:entrada,price:entrada,cons:ct.lanceEfetivo||0,hlMin:true},
    {label:"FGTS utilizado",sac:fgts>0?fgts:null,price:fgts>0?fgts:null,cons:null,hlMin:false},
    {label:"Valor financiado / carta de crédito",sub:"SAC e Price: imediato · Consórcio: carta na contemplação",sac:principal,price:principal,cons:ct.cartaTravada,hlMin:false},
    {label:"Acesso ao imóvel",sac:"Mês 1",price:"Mês 1",cons:`Mês ${cmSafe} (estimativa)`,hlMin:false},
  ];

  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,
      boxShadow:"0 2px 12px rgba(0,0,0,0.04)",marginBottom:20,overflow:"hidden"}}>

      {/* Header clicável */}
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",
        cursor:"pointer",padding:"16px 22px",display:"flex",alignItems:"center",
        justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontFamily:F.display,fontSize:17,fontWeight:700,color:C.text}}>
            Detalhamento de custos
          </span>
          <span style={{fontSize:12,color:C.muted}}>
            Juros · TR · Taxas · Indexador · Aluguel · Total desembolsado
          </span>
        </div>
        <span style={{fontSize:18,color:C.muted,transition:"transform 0.2s",
          transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>

      {open&&(
        <div style={{overflowX:"auto"}}>
          <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:560}}>
            <thead>
              <tr>
                <th style={{...thS,textAlign:"left",width:"38%",padding:"10px 18px"}}>Indicador</th>
                <th style={{...thS,color:C.sac}}>SAC</th>
                <th style={{...thS,color:C.price}}>Price</th>
                <th style={{...thS,color:C.cons}}>Consórcio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row,ri)=>{
                const nums=[row.sac,row.price,row.cons].filter(v=>typeof v==="number");
                const minV=row.hlMin&&nums.length?Math.min(...nums):null;
                return (
                  <tr key={ri} style={{background:ri%2===0?"#fff":"#fafcfa"}}>
                    <td style={{padding:"11px 18px",fontSize:13,color:C.text,
                      borderBottom:`1px solid ${C.border}`,fontFamily:F.body}}>
                      <div style={{fontWeight:500}}>{row.label}</div>
                      {row.sub&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{row.sub}</div>}
                    </td>
                    {[{v:row.sac,color:C.sac},{v:row.price,color:C.price},{v:row.cons,color:C.cons}].map((item,j)=>{
                      const isMin=row.hlMin&&typeof item.v==="number"&&item.v===minV;
                      return (
                        <td key={j} style={{padding:"11px 18px",fontSize:13,textAlign:"center",
                          borderBottom:`1px solid ${C.border}`,fontFamily:F.body,
                          background:isMin?C.accentHl:"transparent",whiteSpace:"nowrap"}}>
                          {renderVal(item.v,item.color,row.hlMin,minV)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Linha total destacada */}
              {(()=>{
                const vals=[sacTotal,priceTotal,consTotal];
                const minV=Math.min(...vals);
                const colors=[C.sac,C.price,C.cons];
                return (
                  <tr style={{background:C.accentBg}}>
                    <td style={{padding:"14px 18px",fontSize:14,fontWeight:700,color:C.text,
                      borderTop:`2px solid ${C.borderMid}`,fontFamily:F.body}}>
                      Total desembolsado
                      <div style={{fontSize:11,color:C.muted,fontWeight:400,marginTop:1}}>
                        Parcelas + entrada / lance + aluguel
                      </div>
                    </td>
                    {vals.map((v,i)=>(
                      <td key={i} style={{padding:"14px 18px",fontSize:14,textAlign:"center",
                        fontWeight:v===minV?700:500,color:v===minV?colors[i]:C.text,
                        background:v===minV?C.accentHl:C.accentBg,
                        borderTop:`2px solid ${C.borderMid}`,whiteSpace:"nowrap",fontFamily:F.body}}>
                        {brl(v)}
                      </td>
                    ))}
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── CENÁRIOS CONTEMPLAÇÃO COMPONENT ────────────────────────────────────────
function CenariosContemplacao({cenarios,cmSafe}) {
  const [open,setOpen]=useState(false);

  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,
      boxShadow:"0 2px 12px rgba(0,0,0,0.04)",marginBottom:20,overflow:"hidden"}}>

      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",
        border:"none",cursor:"pointer",padding:"16px 22px",display:"flex",
        alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontFamily:F.display,fontSize:17,fontWeight:700,color:C.text}}>
            Cenários de contemplação — Consórcio
          </span>
          <span style={{fontSize:12,color:C.muted}}>
            Como os indicadores mudam dependendo de quando você for sorteado
          </span>
        </div>
        <span style={{fontSize:18,color:C.muted,transition:"transform 0.2s",
          transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>

      {open&&(
        <div>
          <div style={{padding:"6px 20px 10px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:12,color:C.muted,fontFamily:F.body}}>
              Coluna destacada = mês selecionado nos inputs
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:400}}>
              <thead>
                <tr>
                  <th style={{padding:"11px 16px",fontSize:11,fontWeight:700,textAlign:"left",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.soft,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em"}}>Indicador</th>
                  {cenarios.map(c=>(
                    <th key={c.cm} style={{padding:"11px 16px",fontSize:11,fontWeight:700,textAlign:"center",borderBottom:`1px solid ${C.border}`,background:c.cm===cmSafe?C.accentBg:C.soft,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em",color:c.cm===cmSafe?C.accent:C.muted}}>
                      Mês {c.cm}{c.cm===cmSafe?" ✓":""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {label:"Carta reajustada",sub:"Valor do crédito recebido na contemplação",fn:c=>brl(c.cartaTravada)},
                  {label:"Desembolso até a contemplação",sub:"Parcelas reajustadas · inclui carta + adm + fundo de reserva",fn:c=>brl(c.desembolsoPre)},
                  {label:"Desembolso pós-contemplação",sub:"Parcelas reajustadas sobre o saldo devedor remanescente",fn:c=>brl(c.desembolsoPos)},
                  {label:"Total desembolsado",sub:"Soma dos dois períodos + lance",fn:c=>brl(c.totalPaid),bold:true},
                ].map((row,ri)=>(
                  <tr key={ri} style={{background:ri%2===0?"#fff":"#fafcfa"}}>
                    <td style={{padding:"11px 16px",fontSize:13,color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:F.body}}>
                      <div style={{fontWeight:row.bold?700:500}}>{row.label}</div>
                      {row.sub&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{row.sub}</div>}
                    </td>
                    {cenarios.map(c=>(
                      <td key={c.cm} style={{
                        padding:"11px 16px",fontSize:13,textAlign:"center",
                        borderBottom:`1px solid ${C.border}`,fontFamily:F.body,
                        background:c.cm===cmSafe?C.accentBg:"transparent",
                        fontWeight:row.bold||c.cm===cmSafe?700:400,
                        color:C.text,whiteSpace:"nowrap",
                      }}>
                        {row.fn(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [imovel,setImovel]=useState(500000);
  const [entrada,setEntrada]=useState(100000);
  const [fgts,setFgts]=useState(0);
  const [juros,setJuros]=useState(11);
  const [trAnual,setTrAnual]=useState(1);
  const [prazoFin,setPrazoFin]=useState(200);
  const [carta,setCarta]=useState(500000);
  const [admin,setAdmin]=useState(20);
  const [fundo,setFundo]=useState(2);
  const [idxAnual,setIdxAnual]=useState(6);
  const [prazoCons,setPrazoCons]=useState(200);
  const [cmMes,setCmMes]=useState(80);
  const [lance,setLance]=useState(0);
  const [aluguel,setAluguel]=useState(0);
  const [promoDesc,setPromoDesc]=useState(0);
  const [promoMeses,setPromoMeses]=useState(0);

  // Amortizações extraordinárias
  const [amortAtiva,setAmortAtiva]=useState(false);
  const [amortMensal,setAmortMensal]=useState(0);
  const [amortAnual,setAmortAnual]=useState(0);
  const [amortMesAnual,setAmortMesAnual]=useState(12);
  const [amortEfeito,setAmortEfeito]=useState("prazo"); // "prazo" | "parcela"

  const rM=useMemo(()=>annualToMonthly(juros),[juros]);
  const trM=useMemo(()=>annualToMonthly(trAnual),[trAnual]);
  const idxM=useMemo(()=>annualToMonthly(idxAnual),[idxAnual]);
  const cmSafe=Math.min(Math.max(Number(cmMes)||1,1),Math.max(Number(prazoCons)||1,1));
  const principal=Math.max(imovel-entrada-fgts,0);

  const sac=useMemo(()=>calcSac(principal,rM,trM,prazoFin),[principal,rM,trM,prazoFin]);
  const price=useMemo(()=>calcPrice(principal,rM,trM,prazoFin),[principal,rM,trM,prazoFin]);
  const cons=useMemo(()=>calcConsorcio(carta,prazoCons,admin/100,fundo/100,idxM,cmSafe,lance,promoDesc/100,promoMeses),[carta,prazoCons,admin,fundo,idxM,cmSafe,lance,promoDesc,promoMeses]);

  const sacAmort=useMemo(()=>amortAtiva?calcSacAmort(principal,rM,trM,prazoFin,amortMensal,amortAnual,amortMesAnual,amortEfeito):null,[principal,rM,trM,prazoFin,amortMensal,amortAnual,amortMesAnual,amortEfeito,amortAtiva]);
  const priceAmort=useMemo(()=>amortAtiva?calcPriceAmort(principal,rM,trM,prazoFin,amortMensal,amortAnual,amortMesAnual,amortEfeito):null,[principal,rM,trM,prazoFin,amortMensal,amortAnual,amortMesAnual,amortEfeito,amortAtiva]);

  const st=sac.totals,pt=price.totals,ct=cons.totals;
  const aluguelMensal=Number(aluguel)||0;
  const aluguelPorMes=useMemo(()=>{
    if(aluguelMensal<=0) return [];
    return Array.from({length:cmSafe},(_,i)=>aluguelMensal*(1+idxM)**i);
  },[aluguelMensal,cmSafe,idxM]);
  const aluguelTotal=aluguelPorMes.reduce((a,v)=>a+v,0);
  const sacTotal=(st.totalPaid||0)+entrada+fgts;
  const priceTotal=(pt.totalPaid||0)+entrada+fgts;
  const consTotal=(ct.totalPaid||0)+aluguelTotal;
  const maxM=Math.min(Math.max(sac.rows.length,price.rows.length,cons.rows.length),360);

  const chartParcelas=useMemo(()=>Array.from({length:maxM},(_,i)=>({month:i+1,SAC:sac.rows[i]?.installment??null,Price:price.rows[i]?.installment??null,Consórcio:cons.rows[i]?.installment??null})),[sac.rows,price.rows,cons.rows,maxM]);

  const chartDesembolso=useMemo(()=>{
    let ac=0;
    return Array.from({length:maxM},(_,i)=>{
      if(i<aluguelPorMes.length) ac+=aluguelPorMes[i];
      return {month:i+1,SAC:sac.rows[i]?sac.rows[i].cumInstall+entrada+fgts:null,Price:price.rows[i]?price.rows[i].cumInstall+entrada+fgts:null,Consórcio:cons.rows[i]?cons.rows[i].cumInstall+ac:null};
    });
  },[sac.rows,price.rows,cons.rows,maxM,entrada,fgts,aluguelPorMes]);

  const chartPatrimonio=useMemo(()=>Array.from({length:maxM},(_,i)=>{
    const m=i+1; const iR=imovel*(1+idxM)**m;
    const sacP=sac.rows[i]?Math.max(iR-sac.rows[i].bal,0):null;
    const priceP=price.rows[i]?Math.max(iR-price.rows[i].bal,0):null;
    let consP=null;
    if(cons.rows[i]){ if(m<cmSafe){consP=0;}else{const iC=cons.meta.cartaTravada*(1+idxM)**(m-cmSafe);consP=Math.max(iC-(cons.rows[i].balance||0),0);} }
    return {month:m,SAC:sacP,Price:priceP,Consórcio:consP};
  }),[sac.rows,price.rows,cons.rows,maxM,imovel,idxM,cmSafe,cons.meta]);

  const thCol=(color)=>({padding:"13px 18px",fontSize:11,fontWeight:700,textAlign:"center",color,borderBottom:`1px solid ${C.border}`,background:C.soft,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em"});

  // Cenários de contemplação
  const cenariosMeses = [40, 80, 120, 160].filter(m => m <= prazoCons);
  const cenarios = useMemo(() => cenariosMeses.map(cm => {
    const c = calcConsorcio(carta, prazoCons, admin/100, fundo/100, idxM, cm, lance, promoDesc/100, promoMeses);
    const ct2 = c.totals;
    const desembolsoPreCm = c.rows.slice(0, cm).reduce((a, r) => a + r.installment, 0)
      + (ct2.lanceEfetivo || 0);
    return {
      cm,
      cartaTravada: ct2.cartaTravada,
      idxPre: ct2.totalIdxPre,
      idxPos: ct2.totalIdxPos,
      desembolsoPre: desembolsoPreCm,
      desembolsoPos: Math.max((ct2.totalPaid || 0) - desembolsoPreCm + (ct2.lanceEfetivo||0), 0),
      totalPaid: ct2.totalPaid,
    };
  }), [carta, prazoCons, admin, fundo, idxM, lance, promoDesc, promoMeses, cenariosMeses.join()]);

  const totaisList=[{label:"SAC",value:sacTotal,color:C.sac},{label:"Price",value:priceTotal,color:C.price},{label:"Consórcio",value:consTotal,color:C.cons}];
  const minT=Math.min(...totaisList.map(t=>t.value));

  // Toggle de visibilidade das linhas nos gráficos
  const [visibleLines,setVisibleLines]=useState({SAC:true,Price:true,"Consórcio":true,"SAC+":true,"Price+":true});
  const toggleLine=(name)=>setVisibleLines(v=>({...v,[name]:!v[name]}));

  // Legenda customizada clicável
  const CustomLegend=({payload})=>(
    <div style={{display:"flex",justifyContent:"center",gap:20,marginTop:8,flexWrap:"wrap"}}>
      {payload.map((p,i)=>{
        const active=visibleLines[p.value];
        const isDashed=p.value==="SAC+"||p.value==="Price+";
        return (
          <div key={i} onClick={()=>toggleLine(p.value)}
            style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",
              opacity:active?1:0.35,transition:"opacity 0.2s",userSelect:"none"}}>
            <svg width="24" height="4" style={{flexShrink:0}}>
              <line x1="0" y1="2" x2="24" y2="2" stroke={p.color} strokeWidth="2.5"
                strokeDasharray={isDashed?"6 3":"none"} strokeLinecap="round"/>
            </svg>
            <span style={{fontSize:12,fontFamily:F.body,color:active?C.text:C.muted,
              fontWeight:active?500:400,textDecoration:active?"none":"line-through"}}>
              {p.value}{isDashed?" (c/ amort.)":""}
            </span>
          </div>
        );
      })}
    </div>
  );

  // Chart saldo devedor
  const chartSaldo=useMemo(()=>Array.from({length:maxM},(_,i)=>({
    month:i+1,
    SAC:sac.rows[i]?.bal||null,
    Price:price.rows[i]?.bal||null,
    "SAC+":sacAmort?.rows[i]?.bal||null,
    "Price+":priceAmort?.rows[i]?.bal||null,
  })),[sac.rows,price.rows,sacAmort,priceAmort,maxM]);

  // Chart parcelas com amort
  const chartParcelasEx=useMemo(()=>Array.from({length:maxM},(_,i)=>({
    month:i+1,
    SAC:sac.rows[i]?.installment>0?sac.rows[i].installment:null,
    Price:price.rows[i]?.installment>0?price.rows[i].installment:null,
    "Consórcio":cons.rows[i]?.installment>0?cons.rows[i].installment:null,
    "SAC+":sacAmort?.rows[i]?.installment>0?sacAmort.rows[i].installment:null,
    "Price+":priceAmort?.rows[i]?.installment>0?priceAmort.rows[i].installment:null,
  })),[sac.rows,price.rows,cons.rows,sacAmort,priceAmort,maxM]);

  const chartDesembolsoEx=useMemo(()=>{
    let ac=0;
    return Array.from({length:maxM},(_,i)=>{
      if(i<aluguelPorMes.length) ac+=aluguelPorMes[i];
      const sacAcum=sacAmort?.rows[i]?(sacAmort.rows[i].cumInstall+sacAmort.rows[i].cumAmortExtra+entrada+fgts):null;
      const priceAcum=priceAmort?.rows[i]?(priceAmort.rows[i].cumInstall+priceAmort.rows[i].cumAmortExtra+entrada+fgts):null;
      return {
        month:i+1,
        SAC:sac.rows[i]?sac.rows[i].cumInstall+entrada+fgts:null,
        Price:price.rows[i]?price.rows[i].cumInstall+entrada+fgts:null,
        "Consórcio":cons.rows[i]?cons.rows[i].cumInstall+ac:null,
        "SAC+":sacAcum,
        "Price+":priceAcum,
      };
    });
  },[sac.rows,price.rows,cons.rows,sacAmort,priceAmort,maxM,entrada,fgts,aluguelPorMes]);

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:F.body}}>

      {/* HEADER */}
      <div style={{background:"#fff",borderBottom:`1px solid ${C.border}`,padding:"16px 32px",display:"flex",alignItems:"center",gap:16,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(0,0,0,0.05)"}}>
        <div style={{width:6,height:36,borderRadius:3,background:C.accent,flexShrink:0}}/>
        <div>
          <div style={{fontFamily:F.display,fontSize:22,fontWeight:700,color:C.text,lineHeight:1.1}}>Simulador de Financiamento Imobiliário</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>Comparativo entre SAC, Price e Consórcio — custo total ao final do prazo</div>
        </div>
      </div>

      <div className="sim-main" style={{maxWidth:1100,margin:"0 auto",padding:"28px 20px"}}>

        {/* INPUTS */}
        <div className="sim-inputs" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
          <InputPanel accentColor={C.sac} label="Financiamento Imobiliário (SAC e Price)">
            <InputMoney label="Valor do imóvel"  value={imovel}  onChange={setImovel}/>
            <InputMoney label="Entrada"          value={entrada} onChange={setEntrada}/>
            <InputMoney label="FGTS"             value={fgts}    onChange={setFgts} hint="Opcional · reduz o principal financiado"/>
            <InputPct   label="CET anual"        value={juros}   onChange={setJuros} hint={`Financia ${brl(principal)} · inclui juros, seguros e taxas`}/>
            <InputPct   label="TR anual"         value={trAnual} onChange={setTrAnual}/>
            <InputInt   label="Prazo (meses)"    value={prazoFin} onChange={setPrazoFin}/>
            {/* AMORTIZAÇÕES EXTRAORDINÁRIAS */}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:2}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Amortizações extraordinárias</div>
                <button onClick={()=>setAmortAtiva(a=>!a)} style={{padding:"4px 12px",borderRadius:8,border:`1.5px solid ${amortAtiva?C.sac:C.border}`,background:amortAtiva?"#eff6ff":"#fff",color:amortAtiva?C.sac:C.muted,fontFamily:F.body,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  {amortAtiva?"Ativado ✓":"Ativar"}
                </button>
              </div>
              {amortAtiva&&(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <InputMoney label="Complemento mensal" value={amortMensal} onChange={setAmortMensal} hint="Valor extra pago todo mês além da parcela"/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <InputMoney label="Amortização anual" value={amortAnual} onChange={setAmortAnual} hint="1x por ano"/>
                    <InputInt   label="Mês do pagamento" value={amortMesAnual} onChange={setAmortMesAnual} hint="1=jan · 12=dez"/>
                  </div>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Efeito da amortização</div>
                    <div style={{display:"flex",gap:8}}>
                      {[{v:"prazo",label:"Reduz o prazo"},{ v:"parcela",label:"Reduz a parcela"}].map(op=>(
                        <button key={op.v} onClick={()=>setAmortEfeito(op.v)} style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1.5px solid ${amortEfeito===op.v?C.sac:C.border}`,background:amortEfeito===op.v?"#eff6ff":"#fff",color:amortEfeito===op.v?C.sac:C.muted,fontFamily:F.body,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Resumo do impacto */}
                  {sacAmort&&(
                    <div style={{background:C.soft,borderRadius:8,padding:"10px 12px",fontSize:12,fontFamily:F.body,lineHeight:1.8}}>
                      <div style={{fontWeight:700,color:C.sac,marginBottom:4}}>Impacto SAC+ — {amortEfeito==="prazo"?"Reduz prazo":"Reduz parcela"}</div>
                      {amortEfeito==="prazo"
                        ?<><span style={{color:C.muted}}>Prazo efetivo:</span> <strong>{sacAmort.totals.prazoEfetivo} meses</strong> <span style={{color:C.accent}}>(-{sacAmort.totals.mesesEconomizados} meses)</span><br/></>
                        :<><span style={{color:C.muted}}>Parcela final:</span> <strong>{brl(sacAmort.totals.installLast)}</strong> <span style={{color:C.muted,fontSize:11}}>(sem amort: {brl(sac.totals.installLast)})</span><br/></>}
                      <span style={{color:C.muted}}>Juros totais SAC+:</span> <strong>{brl(sacAmort.totals.totalInterest)}</strong><br/>
                      <span style={{color:C.muted}}>Juros economizados:</span> <strong style={{color:C.accent}}>{brl((sac.totals.totalInterest||0)-(sacAmort.totals.totalInterest||0))}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </InputPanel>
          <InputPanel accentColor={C.cons} label="Consórcio Imobiliário">
            <InputMoney label="Carta de crédito"         value={carta}     onChange={setCarta}/>
            <InputPct   label="Taxa de administração"    value={admin}     onChange={setAdmin}/>
            <InputPct   label="Fundo de reserva"         value={fundo}     onChange={setFundo} hint="Típico 2%–4% · tratado como custo"/>
            <InputPct   label="Indexador anual"          value={idxAnual}  onChange={setIdxAnual}/>
            <InputInt   label="Prazo (meses)"            value={prazoCons} onChange={setPrazoCons}/>
            <InputInt   label="Mês de contemplação"      value={cmMes}     onChange={setCmMes} hint="Estimativa — sem garantia de data"/>
            <InputMoney label="Lance próprio"            value={lance}     onChange={setLance} hint="Abate o saldo devedor na contemplação"/>
            <InputMoney label="Aluguel mensal na espera" value={aluguel}   onChange={setAluguel} hint={aluguel>0?`Reajustado pelo indexador · total: ${brl(aluguelTotal)}`:"Opcional · deixe zero para ignorar"}/>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:2}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Promoção de entrada</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <InputPct  label="Desconto na parcela" value={promoDesc}  onChange={setPromoDesc}  hint="Ex: 30 = 30% de desconto"/>
                <InputInt  label="Duração (meses)"     value={promoMeses} onChange={setPromoMeses} hint="Meses com desconto"/>
              </div>
              {promoDesc>0&&promoMeses>0&&<div style={{fontSize:11,color:C.muted,marginTop:8,background:C.soft,borderRadius:8,padding:"8px 10px",lineHeight:1.6}}>
                Parcela inicial: <strong style={{color:C.cons}}>{brl(cons.totals?.installFirst||0)}</strong> (com desconto) · sem desconto seria <strong>{brl((cons.totals?.installFirst||0)/(1-promoDesc/100))}</strong>
              </div>}
            </div>
          </InputPanel>
        </div>

        {/* RESUMO EXECUTIVO */}
        {(()=>{
          const menorTotal=Math.min(sacTotal,priceTotal,consTotal);
          const melhor=sacTotal===menorTotal?"SAC":priceTotal===menorTotal?"Price":"Consórcio";
          const difConsFinanc=Math.abs(consTotal-Math.min(sacTotal,priceTotal));
          const melhorFin=sacTotal<=priceTotal?"SAC":"Price";
          const cartaVsImovel=ct.cartaTravada>0?ct.cartaTravada-imovel:0;
          return (
            <div style={{background:`linear-gradient(135deg, ${C.accentBg} 0%, #fff 100%)`,border:`1.5px solid ${C.accent}`,borderRadius:16,padding:"20px 24px",marginBottom:20,boxShadow:"0 2px 12px rgba(45,158,80,0.08)"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:12,fontFamily:F.body}}>Resumo da simulação</div>
              <div style={{fontSize:16,color:C.text,fontFamily:F.body,lineHeight:1.8}}>
                {melhor==="Consórcio"
                  ? <>O <strong>consórcio</strong> tem o menor desembolso total ({brl(consTotal)}), <strong>{brl(difConsFinanc)} a menos</strong> que o {melhorFin}. Porém você acessa o imóvel apenas no <strong>mês {cmSafe}</strong> e recebe uma carta de <strong>{brl(ct.cartaTravada)}</strong> — {cartaVsImovel>0?<>{brl(cartaVsImovel)} acima do valor atual do imóvel, reajustada pelo indexador.</>:<>abaixo do valor atual do imóvel.</>}</>
                  : <>O <strong>{melhor}</strong> tem o menor desembolso total ({brl(menorTotal)}). O consórcio custaria <strong>{brl(difConsFinanc)} a mais</strong>, mas entrega uma carta de <strong>{brl(ct.cartaTravada)}</strong> na contemplação (mês {cmSafe}), {cartaVsImovel>0?<><strong>{brl(cartaVsImovel)} acima</strong> do valor atual do imóvel.</>:<>abaixo do valor atual do imóvel.</>} No financiamento você tem o imóvel <strong>imediatamente</strong>.</>
                }
              </div>
            </div>
          );
        })()}

        {/* DESTAQUES */}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:20,boxShadow:"0 2px 12px rgba(0,0,0,0.04)",marginBottom:24}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14,fontFamily:F.body}}>Total desembolsado</div>
          <div className="sim-hl-cols" style={{display:"flex",gap:12}}>
            {[
              {label:"SAC",value:sacTotal,color:C.sac,pFirst:st.installFirst,pLast:st.installLast},
              {label:"Price",value:priceTotal,color:C.price,pFirst:pt.installFirst,pLast:pt.installLast},
              {label:"Consórcio",value:consTotal,color:C.cons,pFirst:ct.installFirst,pLast:ct.installLast},
            ].map((t,i)=>{
              const isMin=t.value===minT;
              return (
                <div key={i} style={{flex:1,borderRadius:12,padding:"16px 14px",textAlign:"center",background:isMin?C.accentBg:"#fafcfa",border:`1.5px solid ${isMin?C.accent:C.border}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:t.color,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:F.body}}>{t.label}</div>
                  <div style={{fontSize:22,fontWeight:700,color:isMin?C.accent:C.text,fontFamily:F.display,lineHeight:1.1}}>{brl(t.value)}</div>
                  {isMin&&<div style={{fontSize:10,color:C.accent,marginTop:5,fontWeight:700}}>✓ menor</div>}
                  <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${isMin?C.borderMid:C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontFamily:F.body,marginBottom:4}}>
                      <span style={{color:C.muted}}>Parcela inicial</span>
                      <span style={{fontWeight:500,color:C.text}}>{brl(t.pFirst)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontFamily:F.body}}>
                      <span style={{color:C.muted}}>Parcela final</span>
                      <span style={{fontWeight:500,color:C.text}}>{brl(t.pLast)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>




        {/* CUSTOS DETALHADOS */}
        <CustosDetalhados
          st={st} pt={pt} ct={ct}
          sacTotal={sacTotal} priceTotal={priceTotal} consTotal={consTotal}
          principal={principal} entrada={entrada} fgts={fgts}
          aluguelTotal={aluguelTotal} cmSafe={cmSafe}
        />

        {/* GRÁFICOS */}
        <ChartCard title="Evolução das parcelas" subtitle="Parcela mensal em cada modalidade ao longo do tempo. Clique na legenda para mostrar ou ocultar uma linha.">
          <ResponsiveContainer>
            <LineChart data={chartParcelasEx}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend content={<CustomLegend/>}/>
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"Contemplação",fill:C.cons,fontSize:10,fontFamily:F.body}}/>
              <Line type="monotone" dataKey="SAC" stroke={C.sac} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines.SAC}/>
              <Line type="monotone" dataKey="Price" stroke={C.price} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines.Price}/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines["Consórcio"]}/>
              {amortAtiva&&<Line type="monotone" dataKey="SAC+" stroke={C.sac} strokeWidth={2} strokeDasharray="6 3" dot={false} hide={!visibleLines["SAC+"]}/>}
              {amortAtiva&&<Line type="monotone" dataKey="Price+" stroke={C.price} strokeWidth={2} strokeDasharray="6 3" dot={false} hide={!visibleLines["Price+"]}/>}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Desembolso total acumulado" subtitle="Tudo que saiu do bolso acumulado mês a mês (parcelas + entrada/lance + aluguel). Clique na legenda para mostrar ou ocultar uma linha.">
          <ResponsiveContainer>
            <LineChart data={chartDesembolsoEx}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend content={<CustomLegend/>}/>
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"Contemplação",fill:C.cons,fontSize:10,fontFamily:F.body}}/>
              <Line type="monotone" dataKey="SAC" stroke={C.sac} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines.SAC}/>
              <Line type="monotone" dataKey="Price" stroke={C.price} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines.Price}/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines["Consórcio"]}/>
              {amortAtiva&&<Line type="monotone" dataKey="SAC+" stroke={C.sac} strokeWidth={2} strokeDasharray="6 3" dot={false} hide={!visibleLines["SAC+"]}/>}
              {amortAtiva&&<Line type="monotone" dataKey="Price+" stroke={C.price} strokeWidth={2} strokeDasharray="6 3" dot={false} hide={!visibleLines["Price+"]}/>}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Patrimônio líquido ao longo do tempo" subtitle="Valor do imóvel reajustado menos saldo devedor. Consórcio parte do zero — patrimônio existe só após a contemplação. Clique na legenda para mostrar ou ocultar uma linha.">
          <ResponsiveContainer>
            <LineChart data={chartPatrimonio}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend content={<CustomLegend/>}/>
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"Contemplação",fill:C.cons,fontSize:10,fontFamily:F.body}}/>
              <Line type="monotone" dataKey="SAC" stroke={C.sac} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines.SAC}/>
              <Line type="monotone" dataKey="Price" stroke={C.price} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines.Price}/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines["Consórcio"]}/>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolução do saldo devedor" subtitle="Quanto ainda falta pagar do principal ao longo do tempo. SAC cai mais rápido no início · Price cai mais devagar no início mas equaliza. Clique na legenda para mostrar ou ocultar uma linha.">
          <ResponsiveContainer>
            <LineChart data={chartSaldo}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend content={({payload})=>(
                <div style={{display:"flex",justifyContent:"center",gap:20,marginTop:8,flexWrap:"wrap"}}>
                  {[{value:"SAC",color:C.sac},{value:"Price",color:C.price},
                    ...(amortAtiva?[{value:"SAC+",color:C.sac,dashed:true},{value:"Price+",color:C.price,dashed:true}]:[])
                  ].map((p,i)=>{
                    const active=visibleLines[p.value];
                    return (
                      <div key={i} onClick={()=>toggleLine(p.value)}
                        style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",opacity:active?1:0.35,transition:"opacity 0.2s",userSelect:"none"}}>
                        <div style={{width:24,height:3,borderRadius:2,background:p.color,opacity:p.dashed?0.6:1,
                          backgroundImage:p.dashed?"repeating-linear-gradient(90deg,currentColor 0,currentColor 6px,transparent 6px,transparent 9px)":"none"}}/>
                        <span style={{fontSize:12,fontFamily:F.body,color:active?C.text:C.muted,fontWeight:active?500:400,textDecoration:active?"none":"line-through"}}>{p.value}</span>
                      </div>
                    );
                  })}
                </div>
              )}/>
              <Line type="monotone" dataKey="SAC" stroke={C.sac} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines.SAC}/>
              <Line type="monotone" dataKey="Price" stroke={C.price} strokeWidth={2.5} dot={false} strokeLinecap="round" hide={!visibleLines.Price}/>
              {amortAtiva&&<Line type="monotone" dataKey="SAC+" stroke={C.sac} strokeWidth={2} strokeDasharray="6 3" dot={false} hide={!visibleLines["SAC+"]}/>}
              {amortAtiva&&<Line type="monotone" dataKey="Price+" stroke={C.price} strokeWidth={2} strokeDasharray="6 3" dot={false} hide={!visibleLines["Price+"]}/>}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* HISTÓRICO DE PARCELAS */}
        <HistoricoTabela sac={sac} price={price} cons={cons} cmSafe={cmSafe} carta={carta} admin={admin} fundo={fundo} prazoCons={prazoCons}/>

        {/* FLUXO DE CAIXA */}
        <FluxoCaixa sac={sac} price={price} cons={cons} cmSafe={cmSafe} entrada={entrada} fgts={fgts} lance={ct.lanceEfetivo||0} aluguelPorMes={aluguelPorMes} sacAmort={sacAmort} priceAmort={priceAmort} amortAtiva={amortAtiva} amortMesAnual={amortMesAnual}/>

        {/* CENÁRIOS DE CONTEMPLAÇÃO */}
        <CenariosContemplacao cenarios={cenarios} cmSafe={cmSafe}/>

        {/* NOTA */}
        <div style={{background:C.goldBg,border:"1px solid #e8d48a",borderRadius:12,padding:"14px 18px",fontSize:12,color:"#6b4f10",lineHeight:1.7,fontFamily:F.body}}>
          <strong>Premissas:</strong> imóvel reajustado pelo indexador do consórcio. Antes da contemplação o patrimônio do consórcio é zero — a carta é uma promessa de crédito, não um ativo. Não considera FGTS no patrimônio, benfeitorias ou variações de mercado acima do indexador. O mês de contemplação é uma estimativa.
        </div>

      </div>
    </div>
  );
}
