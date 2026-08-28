import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
// ─── FONTS ──────────────────────────────────────────────── v3.0 dark ─────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap";
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
  .sim-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important; }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
  input:focus { outline: none; }
  button { cursor: pointer; }
`;
document.head.appendChild(styleEl);
// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:       "#0d0d0d",
  panel:    "#141414",
  panel2:   "#1c1c1c",
  border:   "#2e2e2e",
  borderMid:"#3a3a3a",
  text:     "#f5f3ee",
  muted:    "#c8c4bc",
  soft:     "#1a1a1a",
  // accent principal
  accent:   "#a3e635",
  accentBg: "rgba(163,230,53,0.07)",
  accentHl: "rgba(163,230,53,0.12)",
  // cores das modalidades
  sac:      "#60a5fa",   // azul
  price:    "#fb923c",   // laranja
  cons:     "#4ade80",   // verde
  // feedback
  goldBg:   "#1c1a10",
};
const F = { body: "'JetBrains Mono', monospace" };
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
function calcSacAmort(principal,rM,trM,months,amortMensal,amortAnual,mesAnual,efeito,periodicidade,anoUnico) {
  if(principal<=0||months<=0) return {rows:[],totals:{}};
  const instOriginais=[];
  if(efeito==="prazo"){
    let b2=principal;
    for(let i=0;i<months;i++){
      const rem=months-i;
      const tr=b2*trM; b2+=tr;
      const amort=b2/rem;
      instOriginais.push(amort+b2*rM);
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
      amort=bal/rem;
      inst=amort+interest;
    }
    bal=Math.max(bal-amort,0);
    cumInstall+=inst; cumInterest+=interest; cumTR+=tr;
    const mNorm=m%12===0?12:m%12;
    const mesNorm=(mesAnual||12)%12===0?12:(mesAnual||12)%12;
    const anoAtual=Math.ceil(m/12);
    const isAnual=amortAnual>0&&mNorm===mesNorm&&(periodicidade==="uma_vez"?(anoAtual===(anoUnico||1)):true);
    const extra=Math.min((amortMensal||0)+(isAnual?(amortAnual||0):0), bal);
    bal=Math.max(bal-extra,0);
    cumAmortExtra+=extra;
    rows.push({month:m,installment:inst,interest,tr,amort,amortExtra:extra,bal,cumInstall,cumInterest,cumTR,cumAmortExtra});
    if(efeito==="prazo"&&bal<0.01) break;
  }
  const last=rows[rows.length-1]||{};
  const validRows=rows.filter(r=>r.installment>0.01);
  const prazoEfetivo=efeito==="prazo"?rows.length:months;
  return {rows,totals:{installFirst:rows[0]?.installment||0,installLast:validRows[validRows.length-1]?.installment||0,totalInterest:last.cumInterest||0,totalTR:last.cumTR||0,totalAmort:principal,totalPaid:(last.cumInstall||0)+(last.cumAmortExtra||0),totalAmortExtra:last.cumAmortExtra||0,prazoEfetivo,mesesEconomizados:efeito==="prazo"?months-rows.length:0}};
}
// ─── CALC: PRICE COM AMORTIZAÇÃO EXTRAORDINÁRIA ───────────────────────────────
function calcPriceAmort(principal,rM,trM,months,amortMensal,amortAnual,mesAnual,efeito,periodicidade,anoUnico) {
  if(principal<=0||months<=0) return {rows:[],totals:{}};
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
      inst=pmtFn(bal,rM,rem);
      amort=Math.max(inst-interest,0);
    }
    bal=Math.max(bal-amort,0);
    cumInstall+=inst; cumInterest+=interest; cumTR+=tr;
    const mNorm=m%12===0?12:m%12;
    const mesNorm=(mesAnual||12)%12===0?12:(mesAnual||12)%12;
    const anoAtual=Math.ceil(m/12);
    const isAnual=amortAnual>0&&mNorm===mesNorm&&(periodicidade==="uma_vez"?(anoAtual===(anoUnico||1)):true);
    const extra=Math.min((amortMensal||0)+(isAnual?(amortAnual||0):0), bal);
    bal=Math.max(bal-extra,0);
    cumAmortExtra+=extra;
    rows.push({month:m,installment:inst,interest,tr,amort,amortExtra:extra,bal,cumInstall,cumInterest,cumTR,cumAmortExtra});
    if(efeito==="prazo"&&bal<0.01) break;
  }
  const last=rows[rows.length-1]||{};
  const validRows=rows.filter(r=>r.installment>0.01);
  const prazoEfetivo=efeito==="prazo"?rows.length:months;
  return {rows,totals:{installFirst:rows[0]?.installment||0,installLast:validRows[validRows.length-1]?.installment||0,totalInterest:last.cumInterest||0,totalTR:last.cumTR||0,totalAmort:principal,totalPaid:(last.cumInstall||0)+(last.cumAmortExtra||0),totalAmortExtra:last.cumAmortExtra||0,prazoEfetivo,mesesEconomizados:efeito==="prazo"?months-rows.length:0}};
}
// ─── CALC: CONSÓRCIO ──────────────────────────────────────────────────────────
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
  const recalcMes=promoD>0?(promoM<cm?promoM+1:cm):null;
  let saldoNoRecalc=0;
  if(recalcMes!==null){
    let s=grossTotal;
    for(let m=1;m<recalcMes;m++){
      s=s*(1+idxM);
      const p=parcelaBase*(1+idxM)**(m-1);
      s=Math.max(s-p*(m<=promoM?(1-promoD):1),0);
    }
    s=s*(1+idxM);
    saldoNoRecalc=s;
  }
  const mesesAposRecalc=recalcMes!==null?months-recalcMes+1:0;
  const parcelaRecalcBase=recalcMes!==null&&mesesAposRecalc>0?saldoNoRecalc/mesesAposRecalc:0;
  let saldoNaCm=0;
  if(recalcMes!==null&&promoM>=cm){ saldoNaCm=saldoNoRecalc; }
  else if(recalcMes!==null&&promoM<cm){ saldoNaCm=parcelaRecalcBase*(months-cm); }
  else {
    // Sem promoção: simula mês a mês (saldo cresce pelo índice, parcela indexada
    // é subtraída) em vez da fórmula fechada anterior, que corrigia todas as
    // parcelas já pagas pelo fator acumulado até `cm` — o que superestimava o
    // quanto da dívida já havia sido abatido.
    let s=grossTotal;
    for(let m=1;m<=cm;m++){
      s=s*(1+idxM);
      const p=parcelaBase*(1+idxM)**(m-1);
      s=Math.max(s-p,0);
    }
    saldoNaCm=s;
  }
  const lanceEfetivo=Math.min(lanceSafe,saldoNaCm);
  const saldoPos=Math.max(saldoNaCm-lanceEfetivo,0);
  const mesesPos=months-cm;
  let parcelaPosBase;
  if(lanceSafe>0&&mesesPos>0){ parcelaPosBase=saldoPos/mesesPos; }
  else if(promoD>0){ const mesesDesdeRecalc=cm-recalcMes; parcelaPosBase=parcelaRecalcBase*(1+idxM)**mesesDesdeRecalc; }
  else { parcelaPosBase=parcelaBase*(1+idxM)**(cm-1); }
  let idxPre=0,idxPos=0,cumInstall=0;
  const rows=Array.from({length:months},(_,i)=>{
    const m=i+1;
    let installment,parcelaBase_m,idxAdj;
    if(m<=cm){
      if(promoD>0&&m<recalcMes){ parcelaBase_m=parcelaBase*(1+idxM)**(m-1); installment=parcelaBase_m*(1-promoD); }
      else if(promoD>0&&m>=recalcMes){ parcelaBase_m=parcelaRecalcBase*(1+idxM)**(m-recalcMes); installment=parcelaBase_m; }
      else { parcelaBase_m=parcelaBase*(1+idxM)**(m-1); installment=parcelaBase_m; }
      idxAdj=Math.max(installment-parcelaBase,0); idxPre+=idxAdj;
    } else {
      parcelaBase_m=parcelaPosBase*(1+idxM)**(m-cm); installment=parcelaBase_m;
      idxAdj=Math.max(installment-parcelaBase,0); idxPos+=idxAdj;
    }
    if(m===cm) cumInstall+=lanceEfetivo;
    cumInstall+=installment;
    return {month:m,installment,installmentBase:parcelaBase_m,idxAdj,cumInstall,isPos:m>cm};
  });
  const last=rows[rows.length-1];
  return {rows,totals:{installFirst:rows[0]?.installment||0,installLast:last?.installment||0,totalAdm:adminCost,totalFundo:fundoCost,totalIdxPre:idxPre,totalIdxPos:idxPos,totalPaid:last?.cumInstall||0,totalAmort:cartaTravada,cartaTravada,lanceEfetivo,saldoPos},meta:{cartaTravada,lanceEfetivo,adminCost,fundoCost,idxPre,idxPos,cm,promoDescPct:promoD,promoMeses:promoM}};
}
// ─── CALC: CAPITAL INVESTIDO (custo de oportunidade / alavancagem) ────────────
// Simula o capital que NÃO foi usado como entrada/lance sendo investido a uma
// taxa de referência, com a parcela mensal de cada modalidade descontada desse
// mesmo capital (cenário conservador: a parcela "se paga" com o rendimento,
// sem depender de renda extra). `desembolsoMes0` sai antes do mês 1 (entrada de
// financiamento); `desembolsoExtra` sai num mês específico (lance do consórcio,
// pago só na contemplação — por isso o capital rende integralmente até lá).
function calcCapitalAlavancado(capitalTotal,desembolsoMes0,rInvestM,parcelasPorMes,meses,desembolsoExtra=0,mesDesembolsoExtra=null) {
  let bal=Math.max(capitalTotal,0)-Math.max(desembolsoMes0,0);
  let mesInsuficiente=null;
  const rows=[];
  for(let m=1;m<=meses;m++){
    bal=bal*(1+rInvestM);
    bal-=(parcelasPorMes[m-1]||0);
    if(desembolsoExtra>0&&m===mesDesembolsoExtra) bal-=desembolsoExtra;
    if(bal<0&&mesInsuficiente===null) mesInsuficiente=m;
    rows.push({month:m,bal});
  }
  return {rows,final:bal,mesInsuficiente};
}
// ─── INPUTS ───────────────────────────────────────────────────────────────────
const iBase={width:"100%",marginTop:5,padding:"10px 12px",border:`1px solid ${C.borderMid}`,borderRadius:7,fontSize:14,background:C.panel2,boxSizing:"border-box",color:C.text,outline:"none",fontFamily:F.body,transition:"border-color 0.15s"};
function InputMoney({label,value,onChange,hint}) {
  const [raw,setRaw]=useState({digits:""});
  useEffect(()=>{
    const digits=Math.round(value*100).toString();
    setRaw({digits});
  },[value]);
  const handleChange=(e)=>{
    const digits=e.target.value.replace(/\D/g,"");
    setRaw({digits});
    const num=parseInt(digits||"0",10)/100;
    onChange(num);
  };
  const display=(()=>{
    const num=parseInt(raw.digits||"0",10)/100;
    return num===0?"":num.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  })();
  return (
    <label style={{display:"block",fontFamily:F.body}}>
      <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
      <input type="text" inputMode="numeric" value={display} onChange={handleChange}
        placeholder="0,00"
        onFocus={e=>e.target.style.borderColor=C.accent}
        onBlur={e=>e.target.style.borderColor=C.borderMid}
        style={iBase}/>
      {hint&&<div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.4}}>{hint}</div>}
    </label>
  );
}
function InputPct({label,value,onChange,hint}) {
  return (
    <label style={{display:"block",fontFamily:F.body}}>
      <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
      <div style={{position:"relative"}}>
        <input type="number" step="0.01" value={value}
          onChange={e=>onChange(parseFloat(e.target.value)||0)}
          onFocus={e=>{e.target.style.borderColor=C.accent;e.target.select();}}
          onBlur={e=>e.target.style.borderColor=C.borderMid}
          style={{...iBase,paddingRight:32}}/>
        <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.muted,pointerEvents:"none"}}>%</span>
      </div>
      {hint&&<div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.4}}>{hint}</div>}
    </label>
  );
}
function InputInt({label,value,onChange,hint}) {
  return (
    <label style={{display:"block",fontFamily:F.body}}>
      <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
      <input type="number" value={value}
        onChange={e=>onChange(Number(e.target.value))}
        onFocus={e=>e.target.style.borderColor=C.accent}
        onBlur={e=>e.target.style.borderColor=C.borderMid}
        style={iBase}/>
      {hint&&<div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.4}}>{hint}</div>}
    </label>
  );
}
// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function SectionTag({children}) {
  return (
    <div style={{fontSize:12,color:C.muted,letterSpacing:"0.06em",marginBottom:12,display:"flex",alignItems:"center",gap:8,fontFamily:F.body}}>
      <span style={{color:C.borderMid}}>//</span> {children}
    </div>
  );
}
function InputPanel({accentColor,label,children}) {
  return (
    <div style={{background:C.panel,borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
      <div style={{background:C.panel2,borderBottom:`1px solid ${C.border}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:3,height:18,borderRadius:2,background:accentColor,flexShrink:0}}/>
        <span style={{fontFamily:F.body,fontSize:13,fontWeight:600,color:C.text,letterSpacing:"0.03em"}}>{label}</span>
      </div>
      <div style={{padding:20,display:"flex",flexDirection:"column",gap:14}}>{children}</div>
    </div>
  );
}
function ChartCard({title,subtitle,children}) {
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:"20px 20px 12px",marginBottom:12}}>
      <div style={{fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text,marginBottom:3}}>{title}</div>
      {subtitle&&<div style={{fontSize:11,color:C.muted,marginBottom:14,fontFamily:F.body,lineHeight:1.5}}>{subtitle}</div>}
      <div style={{width:"100%",height:280}}>{children}</div>
    </div>
  );
}
const CustomTooltip=({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.panel2,border:`1px solid ${C.borderMid}`,borderRadius:8,padding:"10px 14px",fontFamily:F.body,fontSize:12}}>
      <div style={{fontWeight:600,color:C.muted,marginBottom:6,fontSize:11,letterSpacing:"0.04em"}}>MÊS {label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",gap:16,color:p.color,marginBottom:2}}>
          <span>{p.name}</span><span style={{fontWeight:600}}>{brl(p.value)}</span>
        </div>
      ))}
    </div>
  );
};
// ─── HISTÓRICO ────────────────────────────────────────────────────────────────
function HistoricoTabela({sac,price,cons,cmSafe,carta,admin,fundo,prazoCons,sacAmort,priceAmort,amortAtiva}) {
  const [open,setOpen]=useState(false);
  const [aba,setAba]=useState("SAC");
  const [modo,setModo]=useState("anual");
  const thS={padding:"8px 12px",fontSize:10,fontWeight:600,textAlign:"center",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.panel2,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"};
  const tdC=(bold,color)=>({padding:"7px 12px",fontSize:12,textAlign:"right",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,fontWeight:bold?600:400,color:color||C.text,whiteSpace:"nowrap"});
  const tdL={padding:"7px 12px",fontSize:12,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,color:C.muted,whiteSpace:"nowrap"};
  const filterRows=(rows)=>modo==="anual"?rows.filter(r=>r.month%12===0||r.month===1||r.month===(rows.length)):rows;
  const usaAmortSac=amortAtiva&&sacAmort;
  const usaAmortPrice=amortAtiva&&priceAmort;
  const sacRows=filterRows((usaAmortSac?sacAmort.rows:sac.rows)||[]);
  const priceRows=filterRows((usaAmortPrice?priceAmort.rows:price.rows)||[]);
  const consRows=filterRows(cons.rows||[]);
  const abas=[{id:"SAC",color:C.sac},{id:"Price",color:C.price},{id:"Consórcio",color:C.cons}];
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>//</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Histórico detalhado de parcelas</span>
          <span style={{fontSize:11,color:C.muted}}>SAC · Price · Consórcio</span>
        </div>
        <span style={{fontSize:16,color:C.muted,transition:"transform 0.2s",display:"block",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>
      {open&&(
        <div>
          <div style={{padding:"0 20px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:6}}>
              {abas.map(a=>(
                <button key={a.id} onClick={()=>setAba(a.id)} style={{padding:"5px 14px",borderRadius:6,border:`1px solid ${aba===a.id?a.color:C.border}`,background:aba===a.id?`rgba(${a.id==="SAC"?"96,165,250":a.id==="Price"?"251,146,60":"74,222,128"},0.1)`:"transparent",color:aba===a.id?a.color:C.muted,fontFamily:F.body,fontSize:11,fontWeight:600,transition:"all 0.15s"}}>
                  {a.id}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:6}}>
              {["anual","mensal"].map(m=>(
                <button key={m} onClick={()=>setModo(m)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${modo===m?C.accent:C.border}`,background:modo===m?C.accentBg:"transparent",color:modo===m?C.accent:C.muted,fontFamily:F.body,fontSize:11,fontWeight:600,transition:"all 0.15s"}}>
                  {m==="anual"?"A cada 12 meses":"Mensal"}
                </button>
              ))}
            </div>
          </div>
          {aba==="SAC"&&(
            <div style={{overflowX:"auto",maxHeight:380,overflowY:"auto"}}>
              <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:500}}>
                <thead style={{position:"sticky",top:0,zIndex:2}}>
                  <tr>
                    <th style={{...thS,textAlign:"center"}}>Mês</th>
                    <th style={thS}>Saldo devedor</th>
                    <th style={{...thS,color:C.sac}}>Amortização</th>
                    <th style={{...thS,color:C.sac}}>Juros</th>
                    <th style={thS}>TR</th>
                    {usaAmortSac&&<th style={{...thS,color:C.accent}}>Amort. extra</th>}
                    <th style={{...thS,color:C.sac}}>Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {sacRows.map((r,i)=>(
                    <tr key={r.month} style={{background:i%2===0?C.panel:C.panel2}}>
                      <td style={tdL}>{r.month}</td>
                      <td style={tdC()}>{brl(r.bal)}</td>
                      <td style={tdC(true,C.sac)}>{brl(r.amort)}</td>
                      <td style={tdC()}>{brl(r.interest)}</td>
                      <td style={tdC()}>{brl(r.tr)}</td>
                      {usaAmortSac&&<td style={tdC(true,C.accent)}>{r.amortExtra?brl(r.amortExtra):"—"}</td>}
                      <td style={tdC(true)}>{brl(r.installment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {aba==="Price"&&(
            <div style={{overflowX:"auto",maxHeight:380,overflowY:"auto"}}>
              <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:500}}>
                <thead style={{position:"sticky",top:0,zIndex:2}}>
                  <tr>
                    <th style={{...thS,textAlign:"center"}}>Mês</th>
                    <th style={thS}>Saldo devedor</th>
                    <th style={{...thS,color:C.price}}>Amortização</th>
                    <th style={{...thS,color:C.price}}>Juros</th>
                    <th style={thS}>TR</th>
                    {usaAmortPrice&&<th style={{...thS,color:C.accent}}>Amort. extra</th>}
                    <th style={{...thS,color:C.price}}>Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRows.map((r,i)=>(
                    <tr key={r.month} style={{background:i%2===0?C.panel:C.panel2}}>
                      <td style={tdL}>{r.month}</td>
                      <td style={tdC()}>{brl(r.bal)}</td>
                      <td style={tdC(true,C.price)}>{brl(r.amort)}</td>
                      <td style={tdC()}>{brl(r.interest)}</td>
                      <td style={tdC()}>{brl(r.tr)}</td>
                      {usaAmortPrice&&<td style={tdC(true,C.accent)}>{r.amortExtra?brl(r.amortExtra):"—"}</td>}
                      <td style={tdC(true)}>{brl(r.installment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {aba==="Consórcio"&&(
            <div style={{overflowX:"auto",maxHeight:380,overflowY:"auto"}}>
              <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:580}}>
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
                      <tr key={r.month} style={{background:i%2===0?C.panel:C.panel2}}>
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
// ─── FLUXO DE CAIXA ───────────────────────────────────────────────────────────
function FluxoCaixa({sac,price,cons,cmSafe,entrada,fgts,lance,aluguelPorMes,sacAmort,priceAmort,amortAtiva}) {
  const [open,setOpen]=useState(false);
  const [modo,setModo]=useState("anual");
  const sacRows=(amortAtiva&&sacAmort)?sacAmort.rows:sac.rows;
  const priceRows=(amortAtiva&&priceAmort)?priceAmort.rows:price.rows;
  const maxM=Math.max(sacRows.length,priceRows.length,cons.rows.length);
  const meses=useMemo(()=>{
    if(modo==="mensal") return Array.from({length:maxM},(_,i)=>i+1);
    const s=new Set([1]);
    for(let m=12;m<=maxM;m+=12) s.add(m);
    s.add(maxM);
    return [...s].sort((a,b)=>a-b);
  },[modo,maxM]);
  const thS={padding:"8px 12px",fontSize:10,fontWeight:600,textAlign:"right",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.panel2,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"};
  const tdN=(bold,color,bg)=>({padding:"7px 12px",fontSize:12,textAlign:"right",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,fontWeight:bold?700:400,color:color||C.text,whiteSpace:"nowrap",background:bg||"transparent"});
  const tdM={padding:"7px 12px",fontSize:12,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,color:C.muted,whiteSpace:"nowrap",fontWeight:500};
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>//</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Fluxo de caixa comparativo</span>
          <span style={{fontSize:11,color:C.muted}}>SAC · Price · Consórcio</span>
        </div>
        <span style={{fontSize:16,color:C.muted,transition:"transform 0.2s",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>
      {open&&(
        <div>
          <div style={{padding:"0 20px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.muted,fontFamily:F.body}}>★ = contemplação do consórcio{amortAtiva?" · SAC/Price incluem amortização extra":""}</div>
            <div style={{display:"flex",gap:6}}>
              {["anual","mensal"].map(m=>(
                <button key={m} onClick={()=>setModo(m)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${modo===m?C.accent:C.border}`,background:modo===m?C.accentBg:"transparent",color:modo===m?C.accent:C.muted,fontFamily:F.body,fontSize:11,fontWeight:600,transition:"all 0.15s"}}>
                  {m==="anual"?"A cada 12 meses":"Mensal"}
                </button>
              ))}
            </div>
          </div>
          <div style={{overflowX:"auto",maxHeight:440,overflowY:"auto"}}>
            <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:580}}>
              <thead style={{position:"sticky",top:0,zIndex:2}}>
                <tr>
                  <th style={{...thS,textAlign:"center",width:60}}>Mês</th>
                  <th style={{...thS,color:C.sac}}>SAC</th>
                  <th style={{...thS,color:C.price}}>Price</th>
                  <th style={{...thS,color:C.cons}}>Consórcio</th>
                  <th style={thS}>Menor</th>
                </tr>
              </thead>
              <tbody>
                {(entrada>0||fgts>0||lance>0)&&(
                  <tr style={{background:C.accentBg}}>
                    <td style={{...tdM,color:C.accent,fontWeight:700}}>0</td>
                    <td style={tdN(true,C.sac)}>{entrada+fgts>0?brl(entrada+fgts):"—"}</td>
                    <td style={tdN(true,C.price)}>{entrada+fgts>0?brl(entrada+fgts):"—"}</td>
                    <td style={tdN(true,C.cons)}>{lance>0?brl(lance):<span style={{color:C.muted}}>—</span>}</td>
                    <td style={tdN(false,C.muted)}><span style={{fontSize:10}}>desembolso inicial</span></td>
                  </tr>
                )}
                {meses.map((m,i)=>{
                  const sr=sacRows[m-1]; const pr=priceRows[m-1]; const cr=cons.rows[m-1];
                  const sv=sr?(sr.installment+(sr.amortExtra||0)):null; const pv=pr?(pr.installment+(pr.amortExtra||0)):null;
                  const alug=m<=cmSafe?(aluguelPorMes[m-1]||0):0;
                  const cv=cr?(cr.installment+alug):null;
                  const nums=[sv,pv,cv].filter(v=>v!==null);
                  const minV=nums.length?Math.min(...nums):null;
                  const isCont=m===cmSafe;
                  const rowBg=isCont?C.accentBg:i%2===0?C.panel:C.panel2;
                  return (
                    <tr key={m} style={{background:rowBg}}>
                      <td style={{...tdM,color:isCont?C.accent:C.muted,fontWeight:isCont?700:500}}>{m}{isCont?" ★":""}</td>
                      {[{v:sv,color:C.sac},{v:pv,color:C.price},{v:cv,color:C.cons}].map((item,j)=>{
                        const isMin=item.v!==null&&item.v===minV;
                        return (
                          <td key={j} style={tdN(isMin,isMin?item.color:C.text,isMin?C.accentHl:rowBg)}>
                            {item.v===null?<span style={{color:C.borderMid}}>—</span>:brl(item.v)}
                          </td>
                        );
                      })}
                      <td style={{...tdN(false),textAlign:"center"}}>
                        {minV!==null&&(<span style={{fontSize:11,fontWeight:700,color:sv===minV?C.sac:pv===minV?C.price:C.cons}}>{sv===minV?"SAC":pv===minV?"Price":"Consórcio"}</span>)}
                      </td>
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
// ─── CUSTOS DETALHADOS ────────────────────────────────────────────────────────
function CustosDetalhados({st,pt,ct,sacTotal,priceTotal,consTotal,principal,entrada,fgts,aluguelTotal,cmSafe,amortAtiva}) {
  const [open,setOpen]=useState(false);
  const thS={padding:"9px 16px",fontSize:10,fontWeight:600,textAlign:"center",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.panel2,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em"};
  const renderVal=(v,color,hlMin,minV)=>{
    if(v===null||v===undefined) return <span style={{color:C.borderMid,fontSize:14}}>—</span>;
    if(typeof v==="string") return <span style={{color:C.text,fontSize:12}}>{v}</span>;
    const isMin=hlMin&&v===minV;
    return <span style={{fontWeight:isMin?700:400,color:isMin?color:C.text,fontSize:12}}>{brl(v)}</span>;
  };
  const rows=[
    {label:"Juros + seguros + taxas (CET)",sub:"Custo Efetivo Total contratado",sac:st.totalInterest,price:pt.totalInterest,cons:null,hlMin:true},
    {label:"TR paga",sac:st.totalTR,price:pt.totalTR,cons:null,hlMin:true},
    {label:"Taxa de administração",sac:null,price:null,cons:ct.totalAdm,hlMin:false},
    {label:"Fundo de reserva",sub:"Pode ser devolvido ao final",sac:null,price:null,cons:ct.totalFundo,hlMin:false},
    {label:"Indexador pré-contemplação",sac:null,price:null,cons:ct.totalIdxPre,hlMin:false},
    {label:"Indexador pós-contemplação",sac:null,price:null,cons:ct.totalIdxPos,hlMin:false},
    {label:"Aluguel durante espera",sub:aluguelTotal>0?`${cmSafe} meses`:"Não informado",sac:null,price:null,cons:aluguelTotal>0?aluguelTotal:null,hlMin:false},
    {label:"Amortização extraordinária",sub:"Complemento mensal + aportes anuais",sac:amortAtiva?(st.totalAmortExtra||0):null,price:amortAtiva?(pt.totalAmortExtra||0):null,cons:null,hlMin:false},
    {label:"Entrada / lance",sac:entrada,price:entrada,cons:ct.lanceEfetivo||0,hlMin:true},
    {label:"FGTS utilizado",sac:fgts>0?fgts:null,price:fgts>0?fgts:null,cons:null,hlMin:false},
    {label:"Valor financiado / carta",sac:principal,price:principal,cons:ct.cartaTravada,hlMin:false},
    {label:"Acesso ao imóvel",sac:"Mês 1",price:"Mês 1",cons:`Mês ${cmSafe}`,hlMin:false},
  ];
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>//</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Detalhamento de custos</span>
          <span style={{fontSize:11,color:C.muted}}>Juros · TR · Taxas · Indexador · Total</span>
        </div>
        <span style={{fontSize:16,color:C.muted,transition:"transform 0.2s",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>
      {open&&(
        <div style={{overflowX:"auto"}}>
          <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:520}}>
            <thead>
              <tr>
                <th style={{...thS,textAlign:"left",padding:"9px 16px"}}>Indicador</th>
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
                  <tr key={ri} style={{background:ri%2===0?C.panel:C.panel2}}>
                    <td style={{padding:"10px 16px",fontSize:12,color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:F.body}}>
                      <div style={{fontWeight:500}}>{row.label}</div>
                      {row.sub&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{row.sub}</div>}
                    </td>
                    {[{v:row.sac,color:C.sac},{v:row.price,color:C.price},{v:row.cons,color:C.cons}].map((item,j)=>{
                      const isMin=row.hlMin&&typeof item.v==="number"&&item.v===minV;
                      return (
                        <td key={j} style={{padding:"10px 16px",fontSize:12,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,background:isMin?C.accentHl:"transparent",whiteSpace:"nowrap"}}>
                          {renderVal(item.v,item.color,row.hlMin,minV)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {(()=>{
                const vals=[sacTotal,priceTotal,consTotal];
                const minV=Math.min(...vals);
                const colors=[C.sac,C.price,C.cons];
                return (
                  <tr style={{background:C.accentBg}}>
                    <td style={{padding:"12px 16px",fontSize:13,fontWeight:700,color:C.text,borderTop:`1px solid ${C.borderMid}`,fontFamily:F.body}}>
                      Total desembolsado
                      <div style={{fontSize:10,color:C.muted,fontWeight:400,marginTop:1}}>Parcelas + entrada / lance + aluguel</div>
                    </td>
                    {vals.map((v,i)=>(
                      <td key={i} style={{padding:"12px 16px",fontSize:13,textAlign:"center",fontWeight:v===minV?700:500,color:v===minV?colors[i]:C.text,background:v===minV?C.accentHl:C.accentBg,borderTop:`1px solid ${C.borderMid}`,whiteSpace:"nowrap",fontFamily:F.body}}>
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
// ─── CENÁRIOS CONTEMPLAÇÃO ────────────────────────────────────────────────────
function CenariosContemplacao({cenarios,cmSafe}) {
  const [open,setOpen]=useState(false);
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>//</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Cenários de contemplação</span>
          <span style={{fontSize:11,color:C.muted}}>Como os indicadores mudam pelo mês sorteado</span>
        </div>
        <span style={{fontSize:16,color:C.muted,transition:"transform 0.2s",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>
      {open&&(
        <div style={{overflowX:"auto"}}>
          <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:380}}>
            <thead>
              <tr>
                <th style={{padding:"10px 16px",fontSize:10,fontWeight:600,textAlign:"left",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.panel2,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em"}}>Indicador</th>
                {cenarios.map(c=>(
                  <th key={c.cm} style={{padding:"10px 16px",fontSize:10,fontWeight:600,textAlign:"center",borderBottom:`1px solid ${C.border}`,background:c.cm===cmSafe?C.accentBg:C.panel2,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em",color:c.cm===cmSafe?C.accent:C.muted}}>
                    Mês {c.cm}{c.cm===cmSafe?" ✓":""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {label:"Carta reajustada",fn:c=>brl(c.cartaTravada)},
                {label:"Desembolso pré-contemplação",fn:c=>brl(c.desembolsoPre)},
                {label:"Desembolso pós-contemplação",fn:c=>brl(c.desembolsoPos)},
                {label:"Total desembolsado",fn:c=>brl(c.totalPaid),bold:true},
              ].map((row,ri)=>(
                <tr key={ri} style={{background:ri%2===0?C.panel:C.panel2}}>
                  <td style={{padding:"10px 16px",fontSize:12,color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:F.body,fontWeight:row.bold?700:500}}>{row.label}</td>
                  {cenarios.map(c=>(
                    <td key={c.cm} style={{padding:"10px 16px",fontSize:12,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,background:c.cm===cmSafe?C.accentBg:"transparent",fontWeight:row.bold||c.cm===cmSafe?700:400,color:C.text,whiteSpace:"nowrap"}}>
                      {row.fn(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
// ─── VEÍCULO: HISTÓRICO (2 vias — Financiamento x Consórcio) ──────────────────
function HistoricoTabelaVeiculo({fin,cons,cmSafe,carta,admin,fundo,prazoCons}) {
  const [open,setOpen]=useState(false);
  const [aba,setAba]=useState("Financiamento");
  const [modo,setModo]=useState("anual");
  const thS={padding:"8px 12px",fontSize:10,fontWeight:600,textAlign:"center",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.panel2,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"};
  const tdC=(bold,color)=>({padding:"7px 12px",fontSize:12,textAlign:"right",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,fontWeight:bold?600:400,color:color||C.text,whiteSpace:"nowrap"});
  const tdL={padding:"7px 12px",fontSize:12,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,color:C.muted,whiteSpace:"nowrap"};
  const filterRows=(rows)=>modo==="anual"?rows.filter(r=>r.month%12===0||r.month===1||r.month===(rows.length)):rows;
  const finRows=filterRows(fin.rows||[]);
  const consRows=filterRows(cons.rows||[]);
  const abas=[{id:"Financiamento",color:C.sac},{id:"Consórcio",color:C.cons}];
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>//</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Histórico detalhado de parcelas</span>
          <span style={{fontSize:11,color:C.muted}}>Financiamento (CDC) · Consórcio</span>
        </div>
        <span style={{fontSize:16,color:C.muted,transition:"transform 0.2s",display:"block",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>
      {open&&(
        <div>
          <div style={{padding:"0 20px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:6}}>
              {abas.map(a=>(
                <button key={a.id} onClick={()=>setAba(a.id)} style={{padding:"5px 14px",borderRadius:6,border:`1px solid ${aba===a.id?a.color:C.border}`,background:aba===a.id?`rgba(${a.id==="Financiamento"?"96,165,250":"74,222,128"},0.1)`:"transparent",color:aba===a.id?a.color:C.muted,fontFamily:F.body,fontSize:11,fontWeight:600,transition:"all 0.15s"}}>
                  {a.id}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:6}}>
              {["anual","mensal"].map(m=>(
                <button key={m} onClick={()=>setModo(m)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${modo===m?C.accent:C.border}`,background:modo===m?C.accentBg:"transparent",color:modo===m?C.accent:C.muted,fontFamily:F.body,fontSize:11,fontWeight:600,transition:"all 0.15s"}}>
                  {m==="anual"?"A cada 12 meses":"Mensal"}
                </button>
              ))}
            </div>
          </div>
          {aba==="Financiamento"&&(
            <div style={{overflowX:"auto",maxHeight:380,overflowY:"auto"}}>
              <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:460}}>
                <thead style={{position:"sticky",top:0,zIndex:2}}>
                  <tr>
                    <th style={{...thS,textAlign:"center"}}>Mês</th>
                    <th style={thS}>Saldo devedor</th>
                    <th style={{...thS,color:C.sac}}>Amortização</th>
                    <th style={{...thS,color:C.sac}}>Juros</th>
                    <th style={{...thS,color:C.sac}}>Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {finRows.map((r,i)=>(
                    <tr key={r.month} style={{background:i%2===0?C.panel:C.panel2}}>
                      <td style={tdL}>{r.month}</td>
                      <td style={tdC()}>{brl(r.bal)}</td>
                      <td style={tdC(true,C.sac)}>{brl(r.amort)}</td>
                      <td style={tdC()}>{brl(r.interest)}</td>
                      <td style={tdC(true)}>{brl(r.installment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {aba==="Consórcio"&&(
            <div style={{overflowX:"auto",maxHeight:380,overflowY:"auto"}}>
              <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:580}}>
                <thead style={{position:"sticky",top:0,zIndex:2}}>
                  <tr>
                    <th style={{...thS,textAlign:"center"}}>Mês</th>
                    <th style={{...thS,color:C.cons}}>Fundo comum</th>
                    <th style={{...thS,color:C.cons}}>Taxa de adm</th>
                    <th style={{...thS,color:C.cons}}>Fundo reserva</th>
                    <th style={thS}>Índice</th>
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
                      <tr key={r.month} style={{background:i%2===0?C.panel:C.panel2}}>
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
// ─── VEÍCULO: FLUXO DE CAIXA (2 vias) ─────────────────────────────────────────
function FluxoCaixaVeiculo({fin,cons,cmSafe,entrada,lance}) {
  const [open,setOpen]=useState(false);
  const [modo,setModo]=useState("anual");
  const maxM=Math.max(fin.rows.length,cons.rows.length);
  const meses=useMemo(()=>{
    if(modo==="mensal") return Array.from({length:maxM},(_,i)=>i+1);
    const s=new Set([1]);
    for(let m=12;m<=maxM;m+=12) s.add(m);
    s.add(maxM);
    return [...s].sort((a,b)=>a-b);
  },[modo,maxM]);
  const thS={padding:"8px 12px",fontSize:10,fontWeight:600,textAlign:"right",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.panel2,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"};
  const tdN=(bold,color,bg)=>({padding:"7px 12px",fontSize:12,textAlign:"right",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,fontWeight:bold?700:400,color:color||C.text,whiteSpace:"nowrap",background:bg||"transparent"});
  const tdM={padding:"7px 12px",fontSize:12,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,color:C.muted,whiteSpace:"nowrap",fontWeight:500};
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>//</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Fluxo de caixa comparativo</span>
          <span style={{fontSize:11,color:C.muted}}>Financiamento (CDC) · Consórcio</span>
        </div>
        <span style={{fontSize:16,color:C.muted,transition:"transform 0.2s",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>
      {open&&(
        <div>
          <div style={{padding:"0 20px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.muted,fontFamily:F.body}}>★ = contemplação do consórcio</div>
            <div style={{display:"flex",gap:6}}>
              {["anual","mensal"].map(m=>(
                <button key={m} onClick={()=>setModo(m)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${modo===m?C.accent:C.border}`,background:modo===m?C.accentBg:"transparent",color:modo===m?C.accent:C.muted,fontFamily:F.body,fontSize:11,fontWeight:600,transition:"all 0.15s"}}>
                  {m==="anual"?"A cada 12 meses":"Mensal"}
                </button>
              ))}
            </div>
          </div>
          <div style={{overflowX:"auto",maxHeight:440,overflowY:"auto"}}>
            <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:460}}>
              <thead style={{position:"sticky",top:0,zIndex:2}}>
                <tr>
                  <th style={{...thS,textAlign:"center",width:60}}>Mês</th>
                  <th style={{...thS,color:C.sac}}>Financiamento</th>
                  <th style={{...thS,color:C.cons}}>Consórcio</th>
                  <th style={thS}>Menor</th>
                </tr>
              </thead>
              <tbody>
                {(entrada>0||lance>0)&&(
                  <tr style={{background:C.accentBg}}>
                    <td style={{...tdM,color:C.accent,fontWeight:700}}>0</td>
                    <td style={tdN(true,C.sac)}>{entrada>0?brl(entrada):"—"}</td>
                    <td style={tdN(true,C.cons)}>{lance>0?brl(lance):<span style={{color:C.muted}}>—</span>}</td>
                    <td style={tdN(false,C.muted)}><span style={{fontSize:10}}>desembolso inicial</span></td>
                  </tr>
                )}
                {meses.map((m,i)=>{
                  const fr=fin.rows[m-1]; const cr=cons.rows[m-1];
                  const fv=fr?.installment??null; const cv=cr?.installment??null;
                  const nums=[fv,cv].filter(v=>v!==null);
                  const minV=nums.length?Math.min(...nums):null;
                  const isCont=m===cmSafe;
                  const rowBg=isCont?C.accentBg:i%2===0?C.panel:C.panel2;
                  return (
                    <tr key={m} style={{background:rowBg}}>
                      <td style={{...tdM,color:isCont?C.accent:C.muted,fontWeight:isCont?700:500}}>{m}{isCont?" ★":""}</td>
                      {[{v:fv,color:C.sac},{v:cv,color:C.cons}].map((item,j)=>{
                        const isMin=item.v!==null&&item.v===minV;
                        return (
                          <td key={j} style={tdN(isMin,isMin?item.color:C.text,isMin?C.accentHl:rowBg)}>
                            {item.v===null?<span style={{color:C.borderMid}}>—</span>:brl(item.v)}
                          </td>
                        );
                      })}
                      <td style={{...tdN(false),textAlign:"center"}}>
                        {minV!==null&&(<span style={{fontSize:11,fontWeight:700,color:fv===minV?C.sac:C.cons}}>{fv===minV?"Financiamento":"Consórcio"}</span>)}
                      </td>
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
// ─── VEÍCULO: CUSTOS DETALHADOS (2 vias) ──────────────────────────────────────
function CustosDetalhadosVeiculo({ft,vct,finTotal,consTotal,principal,entrada,iof,cmSafe}) {
  const [open,setOpen]=useState(false);
  const thS={padding:"9px 16px",fontSize:10,fontWeight:600,textAlign:"center",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.panel2,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.07em"};
  const renderVal=(v,color,hlMin,minV)=>{
    if(v===null||v===undefined) return <span style={{color:C.borderMid,fontSize:14}}>—</span>;
    if(typeof v==="string") return <span style={{color:C.text,fontSize:12}}>{v}</span>;
    const isMin=hlMin&&v===minV;
    return <span style={{fontWeight:isMin?700:400,color:isMin?color:C.text,fontSize:12}}>{brl(v)}</span>;
  };
  const rows=[
    {label:"Juros + seguros + taxas (CET)",sub:"Custo Efetivo Total contratado",fin:ft.totalInterest,cons:null,hlMin:false},
    {label:"IOF financiado",sub:iof>0?"Informado manualmente, somado ao valor financiado":"Não informado",fin:iof>0?iof:null,cons:null,hlMin:false},
    {label:"Taxa de administração",fin:null,cons:vct.totalAdm,hlMin:false},
    {label:"Fundo de reserva",sub:"Pode ser devolvido ao final",fin:null,cons:vct.totalFundo,hlMin:false},
    {label:"Indexador pré-contemplação",fin:null,cons:vct.totalIdxPre,hlMin:false},
    {label:"Indexador pós-contemplação",fin:null,cons:vct.totalIdxPos,hlMin:false},
    {label:"Entrada / lance",fin:entrada,cons:vct.lanceEfetivo||0,hlMin:true},
    {label:"Valor financiado / carta",fin:principal,cons:vct.cartaTravada,hlMin:false},
    {label:"Acesso ao veículo",fin:"Mês 1",cons:`Mês ${cmSafe}`,hlMin:false},
  ];
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F.body}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>//</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Detalhamento de custos</span>
          <span style={{fontSize:11,color:C.muted}}>Juros · IOF · Taxas · Indexador · Total</span>
        </div>
        <span style={{fontSize:16,color:C.muted,transition:"transform 0.2s",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </button>
      {open&&(
        <div style={{overflowX:"auto"}}>
          <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:420}}>
            <thead>
              <tr>
                <th style={{...thS,textAlign:"left",padding:"9px 16px"}}>Indicador</th>
                <th style={{...thS,color:C.sac}}>Financiamento</th>
                <th style={{...thS,color:C.cons}}>Consórcio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row,ri)=>{
                const nums=[row.fin,row.cons].filter(v=>typeof v==="number");
                const minV=row.hlMin&&nums.length?Math.min(...nums):null;
                return (
                  <tr key={ri} style={{background:ri%2===0?C.panel:C.panel2}}>
                    <td style={{padding:"10px 16px",fontSize:12,color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:F.body}}>
                      <div style={{fontWeight:500}}>{row.label}</div>
                      {row.sub&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{row.sub}</div>}
                    </td>
                    {[{v:row.fin,color:C.sac},{v:row.cons,color:C.cons}].map((item,j)=>{
                      const isMin=row.hlMin&&typeof item.v==="number"&&item.v===minV;
                      return (
                        <td key={j} style={{padding:"10px 16px",fontSize:12,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,background:isMin?C.accentHl:"transparent",whiteSpace:"nowrap"}}>
                          {renderVal(item.v,item.color,row.hlMin,minV)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {(()=>{
                const vals=[finTotal,consTotal];
                const minV=Math.min(...vals);
                const colors=[C.sac,C.cons];
                return (
                  <tr style={{background:C.accentBg}}>
                    <td style={{padding:"12px 16px",fontSize:13,fontWeight:700,color:C.text,borderTop:`1px solid ${C.borderMid}`,fontFamily:F.body}}>
                      Total desembolsado
                      <div style={{fontSize:10,color:C.muted,fontWeight:400,marginTop:1}}>Parcelas + entrada / lance</div>
                    </td>
                    {vals.map((v,i)=>(
                      <td key={i} style={{padding:"12px 16px",fontSize:13,textAlign:"center",fontWeight:v===minV?700:500,color:v===minV?colors[i]:C.text,background:v===minV?C.accentHl:C.accentBg,borderTop:`1px solid ${C.borderMid}`,whiteSpace:"nowrap",fontFamily:F.body}}>
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
// ─── CUSTO DE OPORTUNIDADE / ALAVANCAGEM ──────────────────────────────────────
// Compara, no mês da contemplação do consórcio, o patrimônio líquido total de
// cada modalidade: (valor do bem − saldo devedor naquele mês) + o que sobrou do
// capital total disponível, ainda investido (rendendo, descontada a parcela
// mensal de cada modalidade — ver calcCapitalAlavancado).
function AlavancagemPanel({capitalTotal,onCapitalChange,taxaRend,onTaxaChange,cmSafe,itens,bemLabel}) {
  const thS={padding:"9px 12px",fontSize:10,fontWeight:600,textAlign:"center",color:C.muted,borderBottom:`1px solid ${C.border}`,background:C.panel2,fontFamily:F.body,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"};
  const tdL={padding:"9px 12px",fontSize:12,color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:F.body};
  const tdC=(bold,color,hl)=>({padding:"9px 12px",fontSize:12,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,fontWeight:bold?700:400,color:color||C.text,background:hl?C.accentHl:"transparent",whiteSpace:"nowrap"});
  const maxPatrim=itens.length?Math.max(...itens.map(i=>i.patrimonioTotal)):0;
  const algumInsuficiente=itens.some(i=>i.mesInsuficiente!=null);
  return (
    <div style={{background:C.panel,borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden",marginBottom:16}}>
      <div style={{background:C.panel2,borderBottom:`1px solid ${C.border}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:3,height:18,borderRadius:2,background:C.accent,flexShrink:0}}/>
        <span style={{fontFamily:F.body,fontSize:13,fontWeight:600,color:C.text,letterSpacing:"0.03em"}}>seu capital</span>
      </div>
      <div style={{padding:20}}>
        <div style={{fontSize:11,color:C.muted,fontFamily:F.body,lineHeight:1.6,marginBottom:16}}>
          Simula usar só o valor de entrada/lance de cada modalidade e manter o restante do seu capital investido, rendendo à taxa abaixo — com a parcela mensal descontada desse rendimento. Compara o patrimônio total (bem − dívida + capital que sobrou) no mês {cmSafe}, quando o consórcio contemplaria.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
          <InputMoney label="Capital total disponível" value={capitalTotal} onChange={onCapitalChange} hint="Quanto você tem em caixa hoje para essa decisão"/>
          <InputPct   label="Rendimento do capital (a.a.)" value={taxaRend} onChange={onTaxaChange} hint="Taxa da aplicação onde o capital não usado ficaria (ex: CDI líquido)"/>
        </div>
        <div style={{overflowX:"auto"}}>
          <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:520}}>
            <thead>
              <tr>
                <th style={{...thS,textAlign:"left"}}>Modalidade</th>
                <th style={thS}>Desembolso imediato</th>
                <th style={thS}>Capital ainda investido (mês {cmSafe})</th>
                <th style={thS}>Saldo devedor (mês {cmSafe})</th>
                <th style={thS}>Patrimônio do {bemLabel}</th>
                <th style={thS}>Patrimônio total</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it,i)=>{
                const isMax=it.patrimonioTotal===maxPatrim;
                return (
                  <tr key={it.label} style={{background:i%2===0?C.panel:C.panel2}}>
                    <td style={{...tdL,fontWeight:600,color:it.color}}>{it.label}</td>
                    <td style={tdC()}>{brl(it.desembolso)}</td>
                    <td style={tdC(false,it.capitalFinal<0?"#f87171":C.text)}>{brl(it.capitalFinal)}</td>
                    <td style={tdC()}>{brl(it.saldoDevedor)}</td>
                    <td style={tdC()}>{brl(it.valorAtivo)}</td>
                    <td style={tdC(isMax,isMax?C.accent:C.text,isMax)}>{brl(it.patrimonioTotal)}{isMax&&" ✓"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {algumInsuficiente&&(
          <div style={{marginTop:12,fontSize:11,color:"#fbbf24",fontFamily:F.body,lineHeight:1.6,background:"rgba(251,191,36,0.07)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:8,padding:"10px 14px"}}>
            ⚠ {itens.filter(i=>i.mesInsuficiente!=null).map(i=>`${i.label} (a partir do mês ${i.mesInsuficiente})`).join(", ")}: o rendimento do capital não foi suficiente para cobrir a parcela em algum momento — a partir daí, o capital investido passa a ser consumido (ficando negativo), o que na prática exigiria aporte extra de renda.
          </div>
        )}
      </div>
    </div>
  );
}
// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [modo,setModo]=useState("imovel");
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
  const [amortAtiva,setAmortAtiva]=useState(false);
  const [amortMensal,setAmortMensal]=useState(0);
  const [amortAnual,setAmortAnual]=useState(0);
  const [amortMesAnual,setAmortMesAnual]=useState(12);
  const [amortEfeito,setAmortEfeito]=useState("prazo");
  const [amortPeriodicidade,setAmortPeriodicidade]=useState("todo_ano");
  const [amortAno,setAmortAno]=useState(5);
  // ── veículo: financiamento CDC (Tabela Price, sem TR) x consórcio ─────────
  const [veicValor,setVeicValor]=useState(80000);
  const [veicEntrada,setVeicEntrada]=useState(20000);
  const [veicCET,setVeicCET]=useState(22);
  const [veicIOF,setVeicIOF]=useState(0);
  const [veicPrazo,setVeicPrazo]=useState(48);
  const [veicCarta,setVeicCarta]=useState(80000);
  const [veicAdmin,setVeicAdmin]=useState(18);
  const [veicFundo,setVeicFundo]=useState(2);
  const [veicIdx,setVeicIdx]=useState(6);
  const [veicPrazoCons,setVeicPrazoCons]=useState(70);
  const [veicCmMes,setVeicCmMes]=useState(30);
  const [veicLance,setVeicLance]=useState(0);
  // ── alavancagem patrimonial: modo dedicado, com seus próprios campos ───────
  const [alavValorBem,setAlavValorBem]=useState(500000);
  const [alavEntrada,setAlavEntrada]=useState(100000);
  const [alavCET,setAlavCET]=useState(11);
  const [alavTR,setAlavTR]=useState(1);
  const [alavPrazoFin,setAlavPrazoFin]=useState(200);
  const [alavCarta,setAlavCarta]=useState(500000);
  const [alavAdmin,setAlavAdmin]=useState(20);
  const [alavFundo,setAlavFundo]=useState(2);
  const [alavIdx,setAlavIdx]=useState(6);
  const [alavPrazoCons,setAlavPrazoCons]=useState(200);
  const [alavCmMes,setAlavCmMes]=useState(80);
  const [alavLance,setAlavLance]=useState(100000);
  const [alavCapitalTotal,setAlavCapitalTotal]=useState(200000);
  const [alavRendCapital,setAlavRendCapital]=useState(12);
  const rM=useMemo(()=>annualToMonthly(juros),[juros]);
  const trM=useMemo(()=>annualToMonthly(trAnual),[trAnual]);
  const idxM=useMemo(()=>annualToMonthly(idxAnual),[idxAnual]);
  const cmSafe=Math.min(Math.max(Number(cmMes)||1,1),Math.max(Number(prazoCons)||1,1));
  const principal=Math.max(imovel-entrada-fgts,0);
  const sac=useMemo(()=>calcSac(principal,rM,trM,prazoFin),[principal,rM,trM,prazoFin]);
  const price=useMemo(()=>calcPrice(principal,rM,trM,prazoFin),[principal,rM,trM,prazoFin]);
  const cons=useMemo(()=>calcConsorcio(carta,prazoCons,admin/100,fundo/100,idxM,cmSafe,lance,promoDesc/100,promoMeses),[carta,prazoCons,admin,fundo,idxM,cmSafe,lance,promoDesc,promoMeses]);
  const sacAmort=useMemo(()=>amortAtiva?calcSacAmort(principal,rM,trM,prazoFin,amortMensal,amortAnual,amortMesAnual,amortEfeito,amortPeriodicidade,amortAno):null,[principal,rM,trM,prazoFin,amortMensal,amortAnual,amortMesAnual,amortEfeito,amortAtiva,amortPeriodicidade,amortAno]);
  const priceAmort=useMemo(()=>amortAtiva?calcPriceAmort(principal,rM,trM,prazoFin,amortMensal,amortAnual,amortMesAnual,amortEfeito,amortPeriodicidade,amortAno):null,[principal,rM,trM,prazoFin,amortMensal,amortAnual,amortMesAnual,amortEfeito,amortAtiva,amortPeriodicidade,amortAno]);
  const st=(amortAtiva&&sacAmort)?sacAmort.totals:sac.totals;
  const pt=(amortAtiva&&priceAmort)?priceAmort.totals:price.totals;
  const ct=cons.totals;
  const aluguelMensal=Number(aluguel)||0;
  const aluguelPorMes=useMemo(()=>{
    if(aluguelMensal<=0) return [];
    return Array.from({length:cmSafe},(_,i)=>aluguelMensal*(1+idxM)**i);
  },[aluguelMensal,cmSafe,idxM]);
  const aluguelTotal=aluguelPorMes.reduce((a,v)=>a+v,0);
  // ── veículo: derivados ─────────────────────────────────────────────────────
  const veicRM=useMemo(()=>annualToMonthly(veicCET),[veicCET]);
  const veicIdxM=useMemo(()=>annualToMonthly(veicIdx),[veicIdx]);
  const veicCmSafe=Math.min(Math.max(Number(veicCmMes)||1,1),Math.max(Number(veicPrazoCons)||1,1));
  const veicIofSafe=Math.max(Number(veicIOF)||0,0);
  const veicPrincipal=Math.max(veicValor-veicEntrada,0)+veicIofSafe;
  const veicFin=useMemo(()=>calcPrice(veicPrincipal,veicRM,0,veicPrazo),[veicPrincipal,veicRM,veicPrazo]);
  const veicCons=useMemo(()=>calcConsorcio(veicCarta,veicPrazoCons,veicAdmin/100,veicFundo/100,veicIdxM,veicCmSafe,veicLance,0,0),[veicCarta,veicPrazoCons,veicAdmin,veicFundo,veicIdxM,veicCmSafe,veicLance]);
  const ft=veicFin.totals,vct=veicCons.totals;
  const veicFinTotal=(ft.totalPaid||0)+veicEntrada;
  const veicConsTotal=vct.totalPaid||0;
  const veicMaxM=Math.min(Math.max(veicFin.rows.length,veicCons.rows.length),240);
  // ── alavancagem: derivados (modo próprio, campos próprios) ─────────────────
  const alavRM=useMemo(()=>annualToMonthly(alavCET),[alavCET]);
  const alavTRM=useMemo(()=>annualToMonthly(alavTR),[alavTR]);
  const alavIdxM=useMemo(()=>annualToMonthly(alavIdx),[alavIdx]);
  const alavCmSafe=Math.min(Math.max(Number(alavCmMes)||1,1),Math.max(Number(alavPrazoCons)||1,1));
  const alavPrincipal=Math.max(alavValorBem-alavEntrada,0);
  const alavFin=useMemo(()=>calcPrice(alavPrincipal,alavRM,alavTRM,alavPrazoFin),[alavPrincipal,alavRM,alavTRM,alavPrazoFin]);
  const alavCons=useMemo(()=>calcConsorcio(alavCarta,alavPrazoCons,alavAdmin/100,alavFundo/100,alavIdxM,alavCmSafe,alavLance,0,0),[alavCarta,alavPrazoCons,alavAdmin,alavFundo,alavIdxM,alavCmSafe,alavLance]);
  const aft=alavFin.totals,act=alavCons.totals;
  const alavRInvestM=annualToMonthly(alavRendCapital);
  const alavCapFin=calcCapitalAlavancado(alavCapitalTotal,alavEntrada,alavRInvestM,alavFin.rows.map(r=>r.installment),alavCmSafe,0,null);
  const alavCapCons=calcCapitalAlavancado(alavCapitalTotal,0,alavRInvestM,alavCons.rows.map(r=>r.installment),alavCmSafe,act.lanceEfetivo||0,alavCmSafe);
  const alavSaldoFinCm=alavFin.rows[alavCmSafe-1]?.bal??0;
  const alavSaldoPosConsCm=act.saldoPos??0;
  const itensAlav=[
    {label:"Financiamento",color:C.sac,desembolso:alavEntrada,capitalFinal:alavCapFin.final,mesInsuficiente:alavCapFin.mesInsuficiente,saldoDevedor:alavSaldoFinCm,valorAtivo:Math.max(alavValorBem-alavSaldoFinCm,0),patrimonioTotal:Math.max(alavValorBem-alavSaldoFinCm,0)+alavCapFin.final},
    {label:"Consórcio",color:C.cons,desembolso:act.lanceEfetivo||0,capitalFinal:alavCapCons.final,mesInsuficiente:alavCapCons.mesInsuficiente,saldoDevedor:alavSaldoPosConsCm,valorAtivo:Math.max((act.cartaTravada||0)-alavSaldoPosConsCm,0),patrimonioTotal:Math.max((act.cartaTravada||0)-alavSaldoPosConsCm,0)+alavCapCons.final},
  ];
  const sacTotal=(st.totalPaid||0)+entrada+fgts;
  const priceTotal=(pt.totalPaid||0)+entrada+fgts;
  const consTotal=(ct.totalPaid||0)+aluguelTotal;
  const maxM=Math.min(Math.max(sac.rows.length,price.rows.length,cons.rows.length),360);
  const [visibleLines,setVisibleLines]=useState({SAC:true,Price:true,"Consórcio":true,"SAC+":true,"Price+":true});
  const toggleLine=(name)=>setVisibleLines(v=>({...v,[name]:!v[name]}));
  const CustomLegend=({payload})=>(
    <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:8,flexWrap:"wrap"}}>
      {payload.map((p,i)=>{
        const active=visibleLines[p.value];
        const isDashed=p.value==="SAC+"||p.value==="Price+";
        return (
          <div key={i} onClick={()=>toggleLine(p.value)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",opacity:active?1:0.3,transition:"opacity 0.2s",userSelect:"none"}}>
            <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke={p.color} strokeWidth="2" strokeDasharray={isDashed?"5 3":"none"} strokeLinecap="round"/></svg>
            <span style={{fontSize:11,fontFamily:F.body,color:active?C.text:C.muted,fontWeight:active?500:400}}>{p.value}{isDashed?" (c/ amort.)":""}</span>
          </div>
        );
      })}
    </div>
  );
  const chartParcelasEx=useMemo(()=>Array.from({length:maxM},(_,i)=>({
    month:i+1,
    SAC:sac.rows[i]?.installment>0?sac.rows[i].installment:null,
    Price:price.rows[i]?.installment>0?price.rows[i].installment:null,
    "Consórcio":cons.rows[i]?.installment>0?cons.rows[i].installment:null,
    "SAC+":sacAmort?.rows[i]?.installment>0?sacAmort.rows[i].installment:null,
    "Price+":priceAmort?.rows[i]?.installment>0?priceAmort.rows[i].installment:null,
  })),[sac.rows,price.rows,cons.rows,sacAmort,priceAmort,maxM]);
  const chartDesembolso=useMemo(()=>{
    let ac=0;
    return Array.from({length:maxM},(_,i)=>{
      if(i<aluguelPorMes.length) ac+=aluguelPorMes[i];
      return {month:i+1,SAC:sac.rows[i]?sac.rows[i].cumInstall+entrada+fgts:null,Price:price.rows[i]?price.rows[i].cumInstall+entrada+fgts:null,"Consórcio":cons.rows[i]?cons.rows[i].cumInstall+ac:null};
    });
  },[sac.rows,price.rows,cons.rows,maxM,entrada,fgts,aluguelPorMes]);
  const chartSaldo=useMemo(()=>Array.from({length:maxM},(_,i)=>({
    month:i+1,
    SAC:sac.rows[i]?.bal||null,
    Price:price.rows[i]?.bal||null,
    "SAC+":sacAmort?.rows[i]!=null?sacAmort.rows[i].bal:null,
    "Price+":priceAmort?.rows[i]!=null?priceAmort.rows[i].bal:null,
  })),[sac.rows,price.rows,sacAmort,priceAmort,maxM]);
  const cenariosMeses=[40,80,120,160].filter(m=>m<=prazoCons);
  const cenarios=useMemo(()=>cenariosMeses.map(cm=>{
    const c=calcConsorcio(carta,prazoCons,admin/100,fundo/100,idxM,cm,lance,promoDesc/100,promoMeses);
    const ct2=c.totals;
    const desembolsoPreCm=c.rows.slice(0,cm).reduce((a,r)=>a+r.installment,0)+(ct2.lanceEfetivo||0);
    return {cm,cartaTravada:ct2.cartaTravada,desembolsoPre:desembolsoPreCm,desembolsoPos:Math.max((ct2.totalPaid||0)-desembolsoPreCm+(ct2.lanceEfetivo||0),0),totalPaid:ct2.totalPaid};
  }),[carta,prazoCons,admin,fundo,idxM,lance,promoDesc,promoMeses]);
  const totaisList=[{label:"SAC",value:sacTotal,color:C.sac},{label:"Price",value:priceTotal,color:C.price},{label:"Consórcio",value:consTotal,color:C.cons}];
  const minT=Math.min(...totaisList.map(t=>t.value));
  // ── veículo: gráficos e cenários ───────────────────────────────────────────
  const chartParcelasVeic=useMemo(()=>Array.from({length:veicMaxM},(_,i)=>({
    month:i+1,
    Financiamento:veicFin.rows[i]?.installment>0?veicFin.rows[i].installment:null,
    "Consórcio":veicCons.rows[i]?.installment>0?veicCons.rows[i].installment:null,
  })),[veicFin.rows,veicCons.rows,veicMaxM]);
  const chartDesembolsoVeic=useMemo(()=>Array.from({length:veicMaxM},(_,i)=>({
    month:i+1,
    Financiamento:veicFin.rows[i]?veicFin.rows[i].cumInstall+veicEntrada:null,
    "Consórcio":veicCons.rows[i]?veicCons.rows[i].cumInstall:null,
  })),[veicFin.rows,veicCons.rows,veicMaxM,veicEntrada]);
  const chartSaldoVeic=useMemo(()=>Array.from({length:veicMaxM},(_,i)=>({
    month:i+1,
    Financiamento:veicFin.rows[i]?.bal||null,
  })),[veicFin.rows,veicMaxM]);
  const cenariosMesesVeic=[12,24,36,48,60].filter(m=>m<=veicPrazoCons);
  const cenariosVeic=useMemo(()=>cenariosMesesVeic.map(cm=>{
    const c=calcConsorcio(veicCarta,veicPrazoCons,veicAdmin/100,veicFundo/100,veicIdxM,cm,veicLance,0,0);
    const ct2=c.totals;
    const desembolsoPreCm=c.rows.slice(0,cm).reduce((a,r)=>a+r.installment,0)+(ct2.lanceEfetivo||0);
    return {cm,cartaTravada:ct2.cartaTravada,desembolsoPre:desembolsoPreCm,desembolsoPos:Math.max((ct2.totalPaid||0)-desembolsoPreCm+(ct2.lanceEfetivo||0),0),totalPaid:ct2.totalPaid};
  }),[veicCarta,veicPrazoCons,veicAdmin,veicFundo,veicIdxM,veicLance]);
  const totaisListVeic=[{label:"Financiamento",value:veicFinTotal,color:C.sac},{label:"Consórcio",value:veicConsTotal,color:C.cons}];
  const minTVeic=Math.min(...totaisListVeic.map(t=>t.value));
  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:F.body}}>
      {/* HEADER */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,position:"sticky",top:0,zIndex:100,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:3,height:28,borderRadius:2,background:C.accent,flexShrink:0}}/>
          <div>
            <div style={{fontSize:15,fontWeight:600,color:C.text,lineHeight:1.2,fontFamily:F.body}}>{modo==="imovel"?"Simulador de Financiamento Imobiliário":modo==="veiculo"?"Simulador de Financiamento de Veículo":"Simulador de Alavancagem Patrimonial"}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2,fontFamily:F.body}}>{modo==="imovel"?"by Geraldo Búrigo, CNPI · comparativo SAC · Price · Consórcio":modo==="veiculo"?"by Geraldo Búrigo, CNPI · comparativo Financiamento (CDC) · Consórcio":"by Geraldo Búrigo, CNPI · custo de oportunidade do capital"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[{v:"imovel",label:"Imóvel"},{v:"veiculo",label:"Veículo"},{v:"alavancagem",label:"Alavancagem"}].map(op=>(
            <button key={op.v} onClick={()=>setModo(op.v)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${modo===op.v?C.accent:C.border}`,background:modo===op.v?C.accentBg:"transparent",color:modo===op.v?C.accent:C.muted,fontFamily:F.body,fontSize:12,fontWeight:600,transition:"all 0.15s"}}>
              {op.label}
            </button>
          ))}
        </div>
      </div>
      <div className="sim-main" style={{maxWidth:1080,margin:"0 auto",padding:"24px 16px"}}>
        {modo==="imovel"&&(<>
        {/* INPUTS */}
        <SectionTag>parâmetros da simulação</SectionTag>
        <div className="sim-inputs" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <InputPanel accentColor={C.sac} label="financiamento imobiliário — SAC e Price">
            <InputMoney label="Valor do imóvel"  value={imovel}  onChange={setImovel}/>
            <InputMoney label="Entrada"          value={entrada} onChange={setEntrada}/>
            <InputMoney label="FGTS"             value={fgts}    onChange={setFgts} hint={`Financia ${brl(principal)}`}/>
            <InputPct   label="CET anual"        value={juros}   onChange={setJuros} hint="Inclui juros, seguros e taxas"/>
            <InputPct   label="TR anual"         value={trAnual} onChange={setTrAnual}/>
            <InputInt   label="Prazo (meses)"    value={prazoFin} onChange={setPrazoFin}/>
            {/* AMORTIZAÇÕES */}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:2}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>amortizações extraordinárias</div>
                <button onClick={()=>setAmortAtiva(a=>!a)} style={{padding:"4px 12px",borderRadius:6,border:`1px solid ${amortAtiva?C.sac:C.border}`,background:amortAtiva?"rgba(96,165,250,0.1)":"transparent",color:amortAtiva?C.sac:C.muted,fontFamily:F.body,fontSize:11,fontWeight:600}}>
                  {amortAtiva?"ativado ✓":"ativar"}
                </button>
              </div>
              {amortAtiva&&(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <InputMoney label="Complemento mensal" value={amortMensal} onChange={setAmortMensal} hint="Valor extra além da parcela"/>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>amortização anual</div>
                    <div style={{display:"flex",gap:6,marginBottom:8}}>
                      {[{v:"todo_ano",label:"Todo ano"},{v:"uma_vez",label:"Uma vez"}].map(op=>(
                        <button key={op.v} onClick={()=>setAmortPeriodicidade(op.v)} style={{flex:1,padding:"5px 8px",borderRadius:6,border:`1px solid ${amortPeriodicidade===op.v?C.sac:C.border}`,background:amortPeriodicidade===op.v?"rgba(96,165,250,0.1)":"transparent",color:amortPeriodicidade===op.v?C.sac:C.muted,fontFamily:F.body,fontSize:11,fontWeight:600,transition:"all 0.15s"}}>
                          {op.label}
                        </button>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:amortPeriodicidade==="uma_vez"?"1fr 1fr 1fr":"1fr 1fr",gap:8}}>
                      <InputMoney label="Valor" value={amortAnual} onChange={setAmortAnual}/>
                      {amortPeriodicidade==="uma_vez"&&<InputInt label="Ano" value={amortAno} onChange={setAmortAno} hint="Ex: 5 = 5º ano"/>}
                      <InputInt label="Mês" value={amortMesAnual} onChange={setAmortMesAnual} hint="1=jan · 12=dez"/>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>efeito da amortização</div>
                    <div style={{display:"flex",gap:8}}>
                      {[{v:"prazo",label:"Reduz prazo"},{v:"parcela",label:"Reduz parcela"}].map(op=>(
                        <button key={op.v} onClick={()=>setAmortEfeito(op.v)} style={{flex:1,padding:"7px 8px",borderRadius:6,border:`1px solid ${amortEfeito===op.v?C.sac:C.border}`,background:amortEfeito===op.v?"rgba(96,165,250,0.1)":"transparent",color:amortEfeito===op.v?C.sac:C.muted,fontFamily:F.body,fontSize:11,fontWeight:600,transition:"all 0.15s"}}>
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </InputPanel>
          <InputPanel accentColor={C.cons} label="consórcio imobiliário">
            <InputMoney label="Carta de crédito"         value={carta}     onChange={setCarta}/>
            <InputPct   label="Taxa de administração"    value={admin}     onChange={setAdmin}/>
            <InputPct   label="Fundo de reserva"         value={fundo}     onChange={setFundo} hint="Típico 2%–4%"/>
            <InputPct   label="Indexador anual"          value={idxAnual}  onChange={setIdxAnual}/>
            <InputInt   label="Prazo (meses)"            value={prazoCons} onChange={setPrazoCons}/>
            <InputInt   label="Mês de contemplação"      value={cmMes}     onChange={setCmMes} hint="Estimativa — sem garantia de data"/>
            <InputMoney label="Lance próprio"            value={lance}     onChange={setLance}/>
            <InputMoney label="Aluguel mensal na espera" value={aluguel}   onChange={setAluguel} hint={aluguel>0?`Total: ${brl(aluguelTotal)}`:"Opcional"}/>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:2}}>
              <div style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>promoção de entrada</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <InputPct  label="Desconto na parcela" value={promoDesc}  onChange={setPromoDesc}/>
                <InputInt  label="Duração (meses)"     value={promoMeses} onChange={setPromoMeses}/>
              </div>
            </div>
          </InputPanel>
        </div>
        {/* RESUMO */}
        {(()=>{
          const menorTotal=Math.min(sacTotal,priceTotal,consTotal);
          const melhor=sacTotal===menorTotal?"SAC":priceTotal===menorTotal?"Price":"Consórcio";
          const difConsFinanc=Math.abs(consTotal-Math.min(sacTotal,priceTotal));
          const melhorFin=sacTotal<=priceTotal?"SAC":"Price";
          const cartaVsImovel=ct.cartaTravada>0?ct.cartaTravada-imovel:0;
          return (
            <div style={{background:C.accentBg,border:`1px solid rgba(163,230,53,0.2)`,borderRadius:10,padding:"16px 20px",marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:600,color:C.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,fontFamily:F.body}}>//  resumo da simulação</div>
              <div style={{fontSize:13,color:C.text,fontFamily:F.body,lineHeight:1.8}}>
                {melhor==="Consórcio"
                  ?<>O <strong style={{color:C.cons}}>consórcio</strong> tem o menor desembolso total ({brl(consTotal)}), <strong>{brl(difConsFinanc)} a menos</strong> que o {melhorFin}. Acesso ao imóvel no <strong>mês {cmSafe}</strong>, carta de <strong>{brl(ct.cartaTravada)}</strong> — {cartaVsImovel>0?<>{brl(cartaVsImovel)} acima do valor atual.</>:<>abaixo do valor atual.</>}</>
                  :<>O <strong style={{color:melhor==="SAC"?C.sac:C.price}}>{melhor}</strong> tem o menor desembolso total ({brl(menorTotal)}). O consórcio custaria <strong>{brl(difConsFinanc)} a mais</strong>, mas entrega uma carta de <strong>{brl(ct.cartaTravada)}</strong> no mês {cmSafe}. No financiamento você tem o imóvel <strong>imediatamente</strong>.</>
                }
              </div>
            </div>
          );
        })()}
        {/* DESTAQUES */}
        <SectionTag>total desembolsado</SectionTag>
        <div className="sim-hl-cols" style={{display:"flex",gap:10,marginBottom:16}}>
          {totaisList.map(t=>{
            const isMin=t.value===minT;
            return (
              <div key={t.label} style={{flex:1,borderRadius:10,padding:"16px",textAlign:"center",background:isMin?C.accentBg:C.panel,border:`1px solid ${isMin?"rgba(163,230,53,0.3)":C.border}`}}>
                <div style={{fontSize:10,fontWeight:600,color:t.color,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>{t.label}</div>
                <div style={{fontSize:22,fontWeight:600,color:isMin?C.accent:C.text,letterSpacing:"-0.02em"}}>{brl(t.value)}</div>
                {isMin&&<div style={{fontSize:10,color:C.accent,marginTop:4,fontWeight:600}}>✓ menor custo</div>}
                <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                    <span style={{color:C.muted}}>Parcela inicial</span>
                    <span style={{color:C.text}}>{brl(t.label==="SAC"?st.installFirst:t.label==="Price"?pt.installFirst:ct.installFirst)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                    <span style={{color:C.muted}}>Parcela final</span>
                    <span style={{color:C.text}}>{brl(t.label==="SAC"?st.installLast:t.label==="Price"?pt.installLast:ct.installLast)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* CUSTOS DETALHADOS */}
        <CustosDetalhados st={st} pt={pt} ct={ct} sacTotal={sacTotal} priceTotal={priceTotal} consTotal={consTotal} principal={principal} entrada={entrada} fgts={fgts} aluguelTotal={aluguelTotal} cmSafe={cmSafe} amortAtiva={amortAtiva}/>
        {/* GRÁFICOS */}
        <SectionTag>evolução ao longo do tempo</SectionTag>
        <ChartCard title="// parcela mensal" subtitle="Evolução mês a mês de cada modalidade. Clique na legenda para ocultar uma linha.">
          <ResponsiveContainer>
            <LineChart data={chartParcelasEx}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend content={<CustomLegend/>}/>
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"contemplação",fill:C.cons,fontSize:10}}/>
              <Line type="monotone" dataKey="SAC" stroke={C.sac} strokeWidth={2} dot={false} hide={!visibleLines.SAC}/>
              <Line type="monotone" dataKey="Price" stroke={C.price} strokeWidth={2} dot={false} hide={!visibleLines.Price}/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons} strokeWidth={2} dot={false} hide={!visibleLines["Consórcio"]}/>
              {amortAtiva&&<Line type="monotone" dataKey="SAC+" stroke={C.sac} strokeWidth={1.5} strokeDasharray="5 3" dot={false} hide={!visibleLines["SAC+"]}/>}
              {amortAtiva&&<Line type="monotone" dataKey="Price+" stroke={C.price} strokeWidth={1.5} strokeDasharray="5 3" dot={false} hide={!visibleLines["Price+"]}/>}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="// desembolso acumulado" subtitle="Tudo que saiu do bolso acumulado (parcelas + entrada/lance + aluguel).">
          <ResponsiveContainer>
            <LineChart data={chartDesembolso}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend content={<CustomLegend/>}/>
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"contemplação",fill:C.cons,fontSize:10}}/>
              <Line type="monotone" dataKey="SAC" stroke={C.sac} strokeWidth={2} dot={false} hide={!visibleLines.SAC}/>
              <Line type="monotone" dataKey="Price" stroke={C.price} strokeWidth={2} dot={false} hide={!visibleLines.Price}/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons} strokeWidth={2} dot={false} hide={!visibleLines["Consórcio"]}/>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="// saldo devedor" subtitle="Quanto ainda falta pagar do principal. SAC cai mais rápido no início.">
          <ResponsiveContainer>
            <LineChart data={chartSaldo}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend content={<CustomLegend/>}/>
              <Line type="monotone" dataKey="SAC" stroke={C.sac} strokeWidth={2} dot={false} hide={!visibleLines.SAC}/>
              <Line type="monotone" dataKey="Price" stroke={C.price} strokeWidth={2} dot={false} hide={!visibleLines.Price}/>
              {amortAtiva&&<Line type="monotone" dataKey="SAC+" stroke={C.sac} strokeWidth={1.5} strokeDasharray="5 3" dot={false} hide={!visibleLines["SAC+"]}/>}
              {amortAtiva&&<Line type="monotone" dataKey="Price+" stroke={C.price} strokeWidth={1.5} strokeDasharray="5 3" dot={false} hide={!visibleLines["Price+"]}/>}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        {/* HISTÓRICO, FLUXO E CENÁRIOS */}
        <SectionTag>tabelas detalhadas</SectionTag>
        <HistoricoTabela sac={sac} price={price} cons={cons} cmSafe={cmSafe} carta={carta} admin={admin} fundo={fundo} prazoCons={prazoCons} sacAmort={sacAmort} priceAmort={priceAmort} amortAtiva={amortAtiva}/>
        <FluxoCaixa sac={sac} price={price} cons={cons} cmSafe={cmSafe} entrada={entrada} fgts={fgts} lance={ct.lanceEfetivo||0} aluguelPorMes={aluguelPorMes} sacAmort={sacAmort} priceAmort={priceAmort} amortAtiva={amortAtiva}/>
        <CenariosContemplacao cenarios={cenarios} cmSafe={cmSafe}/>
        {/* NOTA */}
        <div style={{background:"rgba(251,191,36,0.07)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:10,padding:"12px 16px",fontSize:11,color:C.muted,lineHeight:1.7}}>
          <span style={{color:"#fbbf24",fontWeight:600}}>// premissas · </span>
          Compara o total desembolsado por cada modalidade (parcelas, entrada/lance, aluguel na espera), sem considerar custo de oportunidade do capital ao longo do tempo. O mês de contemplação é uma estimativa, sem garantia de data. Conteúdo educacional — não constitui recomendação de investimento.
        </div>
        </>)}
        {modo==="veiculo"&&(<>
        {/* INPUTS VEÍCULO */}
        <SectionTag>parâmetros da simulação</SectionTag>
        <div className="sim-inputs" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <InputPanel accentColor={C.sac} label="financiamento de veículo — CDC (Tabela Price)">
            <InputMoney label="Valor do veículo"  value={veicValor}  onChange={setVeicValor}/>
            <InputMoney label="Entrada"           value={veicEntrada} onChange={setVeicEntrada}/>
            <InputMoney label="IOF financiado"    value={veicIOF}    onChange={setVeicIOF} hint="Informe o valor do IOF a ser somado ao financiamento"/>
            <InputPct   label="CET anual"         value={veicCET}    onChange={setVeicCET} hint="Inclui juros, seguros e taxas — sem TR, não usa SAC"/>
            <InputInt   label="Prazo (meses)"     value={veicPrazo}  onChange={setVeicPrazo} hint={`Financia ${brl(veicPrincipal)} (valor + IOF − entrada)`}/>
          </InputPanel>
          <InputPanel accentColor={C.cons} label="consórcio de veículo">
            <InputMoney label="Carta de crédito"         value={veicCarta}     onChange={setVeicCarta}/>
            <InputPct   label="Taxa de administração"    value={veicAdmin}     onChange={setVeicAdmin}/>
            <InputPct   label="Fundo de reserva"         value={veicFundo}     onChange={setVeicFundo} hint="Típico 2%–4%"/>
            <InputPct   label="Variação anual (índice)"  value={veicIdx}       onChange={setVeicIdx} hint="Ex: variação da Tabela FIPE do veículo"/>
            <InputInt   label="Prazo (meses)"            value={veicPrazoCons} onChange={setVeicPrazoCons}/>
            <InputInt   label="Mês de contemplação"      value={veicCmMes}     onChange={setVeicCmMes} hint="Estimativa — sem garantia de data"/>
            <InputMoney label="Lance próprio"            value={veicLance}     onChange={setVeicLance}/>
          </InputPanel>
        </div>
        {/* RESUMO VEÍCULO */}
        {(()=>{
          const menorTotal=Math.min(veicFinTotal,veicConsTotal);
          const melhor=veicFinTotal===menorTotal?"Financiamento":"Consórcio";
          const dif=Math.abs(veicConsTotal-veicFinTotal);
          const cartaVsVeiculo=vct.cartaTravada>0?vct.cartaTravada-veicValor:0;
          return (
            <div style={{background:C.accentBg,border:`1px solid rgba(163,230,53,0.2)`,borderRadius:10,padding:"16px 20px",marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:600,color:C.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,fontFamily:F.body}}>//  resumo da simulação</div>
              <div style={{fontSize:13,color:C.text,fontFamily:F.body,lineHeight:1.8}}>
                {melhor==="Consórcio"
                  ?<>O <strong style={{color:C.cons}}>consórcio</strong> tem o menor desembolso total ({brl(veicConsTotal)}), <strong>{brl(dif)} a menos</strong> que o financiamento. Acesso ao veículo no <strong>mês {veicCmSafe}</strong>, carta de <strong>{brl(vct.cartaTravada)}</strong> — {cartaVsVeiculo>0?<>{brl(cartaVsVeiculo)} acima do valor atual.</>:<>abaixo do valor atual.</>}</>
                  :<>O <strong style={{color:C.sac}}>financiamento</strong> tem o menor desembolso total ({brl(veicFinTotal)}). O consórcio custaria <strong>{brl(dif)} a mais</strong>, mas entrega uma carta de <strong>{brl(vct.cartaTravada)}</strong> no mês {veicCmSafe}. No financiamento você tem o veículo <strong>imediatamente</strong>.</>
                }
              </div>
            </div>
          );
        })()}
        {/* DESTAQUES VEÍCULO */}
        <SectionTag>total desembolsado</SectionTag>
        <div className="sim-hl-cols" style={{display:"flex",gap:10,marginBottom:16}}>
          {totaisListVeic.map(t=>{
            const isMin=t.value===minTVeic;
            return (
              <div key={t.label} style={{flex:1,borderRadius:10,padding:"16px",textAlign:"center",background:isMin?C.accentBg:C.panel,border:`1px solid ${isMin?"rgba(163,230,53,0.3)":C.border}`}}>
                <div style={{fontSize:10,fontWeight:600,color:t.color,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>{t.label}</div>
                <div style={{fontSize:22,fontWeight:600,color:isMin?C.accent:C.text,letterSpacing:"-0.02em"}}>{brl(t.value)}</div>
                {isMin&&<div style={{fontSize:10,color:C.accent,marginTop:4,fontWeight:600}}>✓ menor custo</div>}
                <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                    <span style={{color:C.muted}}>Parcela inicial</span>
                    <span style={{color:C.text}}>{brl(t.label==="Financiamento"?ft.installFirst:vct.installFirst)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                    <span style={{color:C.muted}}>Parcela final</span>
                    <span style={{color:C.text}}>{brl(t.label==="Financiamento"?ft.installLast:vct.installLast)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* CUSTOS DETALHADOS VEÍCULO */}
        <CustosDetalhadosVeiculo ft={ft} vct={vct} finTotal={veicFinTotal} consTotal={veicConsTotal} principal={veicPrincipal} entrada={veicEntrada} iof={veicIofSafe} cmSafe={veicCmSafe}/>
        {/* GRÁFICOS VEÍCULO */}
        <SectionTag>evolução ao longo do tempo</SectionTag>
        <ChartCard title="// parcela mensal" subtitle="Evolução mês a mês de cada modalidade.">
          <ResponsiveContainer>
            <LineChart data={chartParcelasVeic}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend/>
              <ReferenceLine x={veicCmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"contemplação",fill:C.cons,fontSize:10}}/>
              <Line type="monotone" dataKey="Financiamento" stroke={C.sac} strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons} strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="// desembolso acumulado" subtitle="Tudo que saiu do bolso acumulado (parcelas + entrada/lance).">
          <ResponsiveContainer>
            <LineChart data={chartDesembolsoVeic}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend/>
              <ReferenceLine x={veicCmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"contemplação",fill:C.cons,fontSize:10}}/>
              <Line type="monotone" dataKey="Financiamento" stroke={C.sac} strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons} strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="// saldo devedor" subtitle="Quanto ainda falta pagar do financiamento.">
          <ResponsiveContainer>
            <LineChart data={chartSaldoVeic}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend/>
              <Line type="monotone" dataKey="Financiamento" stroke={C.sac} strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        {/* HISTÓRICO, FLUXO E CENÁRIOS VEÍCULO */}
        <SectionTag>tabelas detalhadas</SectionTag>
        <HistoricoTabelaVeiculo fin={veicFin} cons={veicCons} cmSafe={veicCmSafe} carta={veicCarta} admin={veicAdmin} fundo={veicFundo} prazoCons={veicPrazoCons}/>
        <FluxoCaixaVeiculo fin={veicFin} cons={veicCons} cmSafe={veicCmSafe} entrada={veicEntrada} lance={vct.lanceEfetivo||0}/>
        <CenariosContemplacao cenarios={cenariosVeic} cmSafe={veicCmSafe}/>
        {/* NOTA VEÍCULO */}
        <div style={{background:"rgba(251,191,36,0.07)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:10,padding:"12px 16px",fontSize:11,color:C.muted,lineHeight:1.7}}>
          <span style={{color:"#fbbf24",fontWeight:600}}>// premissas · </span>
          Financiamento de veículo modelado como Tabela Price sem correção monetária (TR), já que não se aplica a CDC de veículo. IOF é informado manualmente e somado ao valor financiado. Consórcio de veículo usa a mesma mecânica do consórcio imobiliário — carta, taxa de administração, fundo de reserva e indexador — mas com prazos e taxas típicos do bem. O mês de contemplação é uma estimativa, sem garantia de data. Conteúdo educacional — não constitui recomendação de investimento.
        </div>
        </>)}
        {modo==="alavancagem"&&(<>
        {/* INPUTS ALAVANCAGEM */}
        <SectionTag>parâmetros da simulação</SectionTag>
        <div className="sim-inputs" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <InputPanel accentColor={C.sac} label="financiamento (tabela price)">
            <InputMoney label="Valor do bem"      value={alavValorBem} onChange={setAlavValorBem}/>
            <InputMoney label="Entrada"           value={alavEntrada}  onChange={setAlavEntrada}/>
            <InputPct   label="CET anual"         value={alavCET}      onChange={setAlavCET} hint="Inclui juros, seguros e taxas"/>
            <InputPct   label="TR anual"          value={alavTR}       onChange={setAlavTR} hint="Deixe 0 para veículo (CDC não tem TR)"/>
            <InputInt   label="Prazo (meses)"     value={alavPrazoFin} onChange={setAlavPrazoFin} hint={`Financia ${brl(alavPrincipal)}`}/>
          </InputPanel>
          <InputPanel accentColor={C.cons} label="consórcio">
            <InputMoney label="Carta de crédito"         value={alavCarta}     onChange={setAlavCarta}/>
            <InputPct   label="Taxa de administração"    value={alavAdmin}     onChange={setAlavAdmin}/>
            <InputPct   label="Fundo de reserva"         value={alavFundo}     onChange={setAlavFundo} hint="Típico 2%–4%"/>
            <InputPct   label="Indexador anual"          value={alavIdx}       onChange={setAlavIdx}/>
            <InputInt   label="Prazo (meses)"            value={alavPrazoCons} onChange={setAlavPrazoCons}/>
            <InputInt   label="Mês de contemplação"      value={alavCmMes}     onChange={setAlavCmMes} hint="Estimativa — sem garantia de data"/>
            <InputMoney label="Lance próprio"            value={alavLance}     onChange={setAlavLance} hint="O quanto menor, mais 'alavancado' — mais capital sobra investido"/>
          </InputPanel>
        </div>
        {/* PAINEL DE CAPITAL / RESULTADO */}
        <SectionTag>patrimônio total no mês da contemplação</SectionTag>
        <AlavancagemPanel capitalTotal={alavCapitalTotal} onCapitalChange={setAlavCapitalTotal} taxaRend={alavRendCapital} onTaxaChange={setAlavRendCapital} cmSafe={alavCmSafe} itens={itensAlav} bemLabel="bem"/>
        {/* NOTA ALAVANCAGEM */}
        <div style={{background:"rgba(251,191,36,0.07)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:10,padding:"12px 16px",fontSize:11,color:C.muted,lineHeight:1.7}}>
          <span style={{color:"#fbbf24",fontWeight:600}}>// premissas · </span>
          Modo dedicado à tese de "alavancagem de consórcio": usar menos capital no lance e manter o restante investido. Os campos aqui são independentes dos modos Imóvel e Veículo — ajuste-os para representar o seu cenário (ex: TR 0% e prazo mais curto para simular um veículo). A parcela mensal de cada modalidade é descontada do rendimento do capital investido (cenário conservador — não pressupõe renda extra disponível). Quando o capital investido fica negativo, ele seria "coberto" à mesma taxa de rendimento informada, o que é otimista frente ao custo real de crédito emergencial. O mês de contemplação é uma estimativa, sem garantia de data. Conteúdo educacional — não constitui recomendação de investimento.
        </div>
        </>)}
      </div>
    </div>
  );
}
