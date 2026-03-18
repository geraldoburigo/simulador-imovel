import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

// ─── FONTS ────────────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

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
  const amort=principal/months;
  let bal=principal,cumInstall=0,cumInterest=0,cumTR=0,cumAmort=0;
  const rows=Array.from({length:months},(_,i)=>{
    const tr=bal*trM; bal+=tr;
    const interest=bal*rM; const installment=amort+interest;
    bal=Math.max(bal-amort,0);
    cumInstall+=installment; cumInterest+=interest; cumTR+=tr; cumAmort+=amort;
    return {month:i+1,installment,interest,tr,amort,bal,cumInstall,cumInterest,cumTR,cumAmort};
  });
  const last=rows[rows.length-1];
  return {rows,totals:{installFirst:rows[0].installment,installLast:last.installment,totalInterest:last.cumInterest,totalTR:last.cumTR,totalAmort:last.cumAmort,totalPaid:last.cumInstall}};
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

// ─── CALC: CONSÓRCIO ──────────────────────────────────────────────────────────
function calcConsorcio(carta,months,adminPct,fundoReservaPct,idxM,cm,lance) {
  if(carta<=0||months<=0) return {rows:[],totals:{},meta:{}};
  const lanceSafe=Math.max(Number(lance)||0,0);
  const fundoCost=carta*fundoReservaPct;
  const grossTotal=carta*(1+adminPct+fundoReservaPct);
  const parcelaBase=grossTotal/months;
  const fatorCm=(1+idxM)**(cm-1);
  const cartaTravada=carta*fatorCm;
  const grossAtual=grossTotal*fatorCm;
  const paidCm=parcelaBase*fatorCm*cm;
  const saldoBruto=Math.max(grossAtual-paidCm,0);
  const lanceEfetivo=Math.min(lanceSafe,saldoBruto);
  const saldoPos=Math.max(saldoBruto-lanceEfetivo,0);
  const mesesPos=months-cm;
  const parcelaPosBase=mesesPos>0?saldoPos/mesesPos:0;
  const adminCost=carta*adminPct;
  let idxPre=0,idxPos=0,cumInstall=0;
  const rows=Array.from({length:months},(_,i)=>{
    const m=i+1; let installment,idxAdj;
    if(m<=cm){ installment=parcelaBase*(1+idxM)**(m-1); idxAdj=installment-parcelaBase; idxPre+=idxAdj; }
    else { const fRel=(1+idxM)**(m-cm); installment=parcelaPosBase*fRel; idxAdj=installment-parcelaPosBase; idxPos+=idxAdj; }
    if(m===cm) cumInstall+=lanceEfetivo;
    cumInstall+=installment;
    return {month:m,installment,idxAdj,cumInstall,isPos:m>cm};
  });
  const last=rows[rows.length-1];
  return {rows,totals:{installFirst:rows[0].installment,installLast:last.installment,totalAdm:adminCost,totalFundo:fundoCost,totalIdxPre:idxPre,totalIdxPos:idxPos,totalPaid:last.cumInstall,totalAmort:cartaTravada,cartaTravada,lanceEfetivo},meta:{cartaTravada,lanceEfetivo,adminCost,fundoCost,idxPre,idxPos,cm}};
}

// ─── INPUTS ───────────────────────────────────────────────────────────────────
const iBase={width:"100%",marginTop:5,padding:"11px 14px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,background:"#fff",boxSizing:"border-box",color:C.text,outline:"none",fontFamily:F.body,transition:"border-color 0.15s"};

function InputMoney({label,value,onChange,hint}) {
  const [d,setD]=useState(fmtCurrency(value));
  useEffect(()=>{setD(fmtCurrency(value));},[value]);
  return (
    <label style={{display:"block",fontFamily:F.body}}>
      <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
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
      <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
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
      <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
      <input type="number" value={value}
        onChange={e=>onChange(Number(e.target.value))}
        onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
        style={iBase}/>
      {hint&&<div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.4}}>{hint}</div>}
    </label>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function InputPanel({accentColor,label,icon,children}) {
  return (
    <div style={{background:C.panel,borderRadius:16,border:`1px solid ${C.border}`,boxShadow:"0 2px 12px rgba(0,0,0,0.04)",overflow:"hidden"}}>
      <div style={{background:accentColor,padding:"14px 20px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>{icon}</span>
        <span style={{fontFamily:F.display,fontSize:17,fontWeight:700,color:"#fff"}}>{label}</span>
      </div>
      <div style={{padding:20,display:"flex",flexDirection:"column",gap:14}}>{children}</div>
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
      <td style={{padding:"11px 18px",fontSize:13,color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:F.body,width:"34%"}}>
        <div style={{fontWeight:500}}>{label}</div>
        {sub&&<div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.4}}>{sub}</div>}
      </td>
      {vals.map((item,i)=>(
        <td key={i} style={{padding:"11px 18px",fontSize:13,textAlign:"center",borderBottom:`1px solid ${C.border}`,background:hlMin&&item.v===minVal?C.accentHl:"transparent",whiteSpace:"nowrap",fontFamily:F.body}}>
          {renderVal(item)}
        </td>
      ))}
    </tr>
  );
}

function ChartCard({title,subtitle,children}) {
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"22px 22px 14px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)",marginBottom:16}}>
      <div style={{fontFamily:F.display,fontSize:17,fontWeight:700,color:C.text,marginBottom:2}}>{title}</div>
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

  const rM=useMemo(()=>annualToMonthly(juros),[juros]);
  const trM=useMemo(()=>annualToMonthly(trAnual),[trAnual]);
  const idxM=useMemo(()=>annualToMonthly(idxAnual),[idxAnual]);
  const cmSafe=Math.min(Math.max(Number(cmMes)||1,1),Math.max(Number(prazoCons)||1,1));
  const principal=Math.max(imovel-entrada-fgts,0);

  const sac=useMemo(()=>calcSac(principal,rM,trM,prazoFin),[principal,rM,trM,prazoFin]);
  const price=useMemo(()=>calcPrice(principal,rM,trM,prazoFin),[principal,rM,trM,prazoFin]);
  const cons=useMemo(()=>calcConsorcio(carta,prazoCons,admin/100,fundo/100,idxM,cmSafe,lance),[carta,prazoCons,admin,fundo,idxM,cmSafe,lance]);

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
    const c = calcConsorcio(carta, prazoCons, admin/100, fundo/100, idxM, cm, lance);
    const ct2 = c.totals;
    const custo = (ct2.totalAdm||0)+(ct2.totalFundo||0)+(ct2.totalIdxPre||0)+(ct2.totalIdxPos||0);
    const custoPct = ct2.cartaTravada > 0 ? (custo/ct2.cartaTravada)*100 : 0;
    return { cm, cartaTravada: ct2.cartaTravada, idxPos: ct2.totalIdxPos, custoPct, totalPaid: ct2.totalPaid };
  }), [carta, prazoCons, admin, fundo, idxM, lance, cenariosMeses.join()]);

  const sacCusto=(st.totalInterest||0)+(st.totalTR||0);
  const priceCusto=(pt.totalInterest||0)+(pt.totalTR||0);
  const consCusto=(ct.totalAdm||0)+(ct.totalFundo||0)+(ct.totalIdxPre||0)+(ct.totalIdxPos||0);
  const sacPct=principal>0?(sacCusto/principal)*100:0;
  const pricePct=principal>0?(priceCusto/principal)*100:0;
  const consPct=ct.cartaTravada>0?(consCusto/ct.cartaTravada)*100:0;

  const totaisList=[{label:"SAC",value:sacTotal,color:C.sac},{label:"Price",value:priceTotal,color:C.price},{label:"Consórcio",value:consTotal,color:C.cons}];
  const custosList=[{label:"SAC",value:sacPct,color:C.sac},{label:"Price",value:pricePct,color:C.price},{label:"Consórcio",value:consPct,color:C.cons}];
  const minT=Math.min(...totaisList.map(t=>t.value));
  const minC=Math.min(...custosList.map(c=>c.value));

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:F.body}}>

      {/* HEADER */}
      <div style={{background:"#fff",borderBottom:`1px solid ${C.border}`,padding:"16px 32px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(0,0,0,0.05)"}}>
        <div style={{width:40,height:40,borderRadius:12,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🏡</div>
        <div>
          <div style={{fontFamily:F.display,fontSize:20,fontWeight:700,color:C.text,lineHeight:1.1}}>Simulador Imobiliário</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>SAC · Price · Consórcio — comparativo de custo total</div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 20px"}}>

        {/* INPUTS */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
          <InputPanel accentColor={C.sac} label="Financiamento" icon="🏦">
            <InputMoney label="Valor do imóvel"  value={imovel}  onChange={setImovel}/>
            <InputMoney label="Entrada"          value={entrada} onChange={setEntrada}/>
            <InputMoney label="FGTS"             value={fgts}    onChange={setFgts} hint="Opcional · reduz o principal financiado"/>
            <InputPct   label="CET anual"        value={juros}   onChange={setJuros} hint={`Financia ${brl(principal)} · inclui juros, seguros e taxas`}/>
            <InputPct   label="TR anual"         value={trAnual} onChange={setTrAnual}/>
            <InputInt   label="Prazo (meses)"    value={prazoFin} onChange={setPrazoFin}/>
          </InputPanel>
          <InputPanel accentColor={C.cons} label="Consórcio" icon="🤝">
            <InputMoney label="Carta de crédito"         value={carta}     onChange={setCarta}/>
            <InputPct   label="Taxa de administração"    value={admin}     onChange={setAdmin}/>
            <InputPct   label="Fundo de reserva"         value={fundo}     onChange={setFundo} hint="Típico 2%–4% · tratado como custo"/>
            <InputPct   label="Indexador anual"          value={idxAnual}  onChange={setIdxAnual}/>
            <InputInt   label="Prazo (meses)"            value={prazoCons} onChange={setPrazoCons}/>
            <InputInt   label="Mês de contemplação"      value={cmMes}     onChange={setCmMes} hint="Estimativa — sem garantia de data"/>
            <InputMoney label="Lance próprio"            value={lance}     onChange={setLance} hint="Abate o saldo devedor na contemplação"/>
            <InputMoney label="Aluguel mensal na espera" value={aluguel}   onChange={setAluguel} hint={aluguel>0?`Reajustado pelo indexador · total: ${brl(aluguelTotal)}`:"Opcional · deixe zero para ignorar"}/>
          </InputPanel>
        </div>

        {/* CENÁRIOS DE CONTEMPLAÇÃO */}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 2px 12px rgba(0,0,0,0.04)",marginBottom:20,overflow:"hidden"}}>
          <div style={{padding:"14px 20px 10px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:F.display,fontSize:16,fontWeight:700,color:C.text}}>Cenários de contemplação — Consórcio</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2,fontFamily:F.body}}>Como os indicadores mudam dependendo de quando você for sorteado · coluna destacada = mês selecionado nos inputs</div>
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
                  {label:"Carta reajustada",sub:"Valor do crédito recebido",fn:c=>brl(c.cartaTravada)},
                  {label:"Idx pós-contemplação",sub:"Custo puro sem contrapartida",fn:c=>brl(c.idxPos)},
                  {label:"Custo % da carta",sub:"Quanto você paga pelo crédito",fn:c=>`${c.custoPct.toFixed(1)}%`,hlMin:true},
                  {label:"Total desembolsado",sub:"Parcelas + lance",fn:c=>brl(c.totalPaid),hlMin:true},
                ].map((row,ri)=>{
                  const vals=cenarios.map(c=>row.fn(c));
                  const numVals=cenarios.map(c=>row.label.includes("%")?c.custoPct:row.label.includes("Total")?c.totalPaid:null);
                  const minV=row.hlMin?Math.min(...numVals.filter(v=>v!==null)):null;
                  return (
                    <tr key={ri} style={{background:ri%2===0?"#fff":"#fafcfa"}}>
                      <td style={{padding:"11px 16px",fontSize:13,color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:F.body}}>
                        <div style={{fontWeight:500}}>{row.label}</div>
                        {row.sub&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{row.sub}</div>}
                      </td>
                      {cenarios.map((c,ci)=>{
                        const numVal=row.label.includes("%")?c.custoPct:row.label.includes("Total")?c.totalPaid:null;
                        const isMin=row.hlMin&&numVal===minV;
                        const isSelected=c.cm===cmSafe;
                        return (
                          <td key={c.cm} style={{padding:"11px 16px",fontSize:13,textAlign:"center",borderBottom:`1px solid ${C.border}`,fontFamily:F.body,background:isMin?C.accentHl:isSelected?C.accentBg:"transparent",fontWeight:isMin||isSelected?700:400,color:isMin?C.accent:C.text,whiteSpace:"nowrap"}}>
                            {vals[ci]}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* DESTAQUES */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
          {[{title:"Total desembolsado",list:totaisList,min:minT,fmt:(v)=>brl(v)},{title:"Custo puro % do crédito recebido",list:custosList,min:minC,fmt:(v)=>`${v.toFixed(1)}%`}].map((card,ci)=>(
            <div key={ci} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:20,boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14,fontFamily:F.body}}>{card.title}</div>
              <div style={{display:"flex",gap:10}}>
                {card.list.map((t,i)=>(
                  <div key={i} style={{flex:1,borderRadius:12,padding:"14px 10px",textAlign:"center",background:t.value===card.min?C.accentBg:"#fafcfa",border:`1.5px solid ${t.value===card.min?C.accent:C.border}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:t.color,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:F.body}}>{t.label}</div>
                    <div style={{fontSize:18,fontWeight:700,color:t.value===card.min?C.accent:C.text,fontFamily:F.display,lineHeight:1.1}}>{card.fmt(t.value)}</div>
                    {t.value===card.min&&<div style={{fontSize:10,color:C.accent,marginTop:5,fontWeight:700}}>✓ menor</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* TABELA */}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 2px 12px rgba(0,0,0,0.04)",marginBottom:20,overflow:"hidden"}}>
          <div style={{padding:"18px 20px 14px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontFamily:F.display,fontSize:18,fontWeight:700,color:C.text}}>Resultado comparativo</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2,fontFamily:F.body}}>Verde = menor valor na linha</div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table cellPadding="0" style={{borderCollapse:"separate",borderSpacing:0,width:"100%",minWidth:560}}>
              <thead>
                <tr>
                  <th style={{...thCol(C.muted),textAlign:"left",width:"34%"}}>Indicador</th>
                  <th style={thCol(C.sac)}>SAC</th>
                  <th style={thCol(C.price)}>Price</th>
                  <th style={thCol(C.cons)}>Consórcio</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeader label="Parcelas"/>
                <Row label="Parcela inicial" sac={st.installFirst} price={pt.installFirst} cons={ct.installFirst} hlMin even={false}/>
                <Row label="Parcela final"   sac={st.installLast}  price={pt.installLast}  cons={ct.installLast}  hlMin even/>

                <SectionHeader label="Custos"/>
                <Row label="Juros + seguros + taxas (CET)" sub="Custo Efetivo Total contratado" sac={st.totalInterest} price={pt.totalInterest} cons={null} even={false}/>
                <Row label="TR" sac={st.totalTR} price={pt.totalTR} cons={null} even/>
                <Row label="Taxa de administração" sac={null} price={null} cons={ct.totalAdm} even={false}/>
                <Row label="Fundo de reserva" sub="Pode ser devolvido ao final se houver saldo" sac={null} price={null} cons={ct.totalFundo} even/>
                <Row label="Indexador pré-contemplação" sub="Carta e parcela crescem juntas" sac={null} price={null} cons={ct.totalIdxPre} even={false}/>
                <Row label="Indexador pós-contemplação" sub="Carta travada, parcela ainda cresce — custo puro" sac={null} price={null} cons={ct.totalIdxPos} even/>

                <SectionHeader label="Desembolso total"/>
                <Row label="Amortização" sub="Capital devolvido ao imóvel" sac={st.totalAmort} price={pt.totalAmort} cons={ct.totalAmort} even={false}/>
                <Row label="Juros + seguros + taxas" sac={st.totalInterest} price={pt.totalInterest} cons={null} even/>
                <Row label="TR paga" sac={st.totalTR} price={pt.totalTR} cons={null} even={false}/>
                <Row label="Taxa de administração" sac={null} price={null} cons={ct.totalAdm} even/>
                <Row label="Fundo de reserva" sac={null} price={null} cons={ct.totalFundo} even={false}/>
                <Row label="Indexador total" sac={null} price={null} cons={(ct.totalIdxPre||0)+(ct.totalIdxPos||0)} even/>
                <Row label="Entrada / lance" sac={entrada} price={entrada} cons={ct.lanceEfetivo} even={false}/>
                <Row label="FGTS utilizado" sub="Reduz o principal financiado" sac={fgts>0?fgts:null} price={fgts>0?fgts:null} cons={null} even/>
                <Row label="Aluguel durante espera" sub={aluguelTotal>0?`${cmSafe} meses · reajustado pelo indexador`:"Não informado"} sac={null} price={null} cons={aluguelTotal>0?aluguelTotal:null} even={false}/>

                {(()=>{
                  const vals=[sacTotal,priceTotal,consTotal];
                  const minV=Math.min(...vals);
                  const colors=[C.sac,C.price,C.cons];
                  return (
                    <tr style={{background:C.accentBg}}>
                      <td style={{padding:"14px 18px",fontSize:14,fontWeight:700,color:C.text,borderBottom:`1px solid ${C.borderMid}`,borderTop:`2px solid ${C.borderMid}`,fontFamily:F.body}}>
                        Total desembolsado
                        <div style={{fontSize:11,color:C.muted,fontWeight:400,marginTop:1}}>Parcelas + entrada / lance + aluguel</div>
                      </td>
                      {vals.map((v,i)=>(
                        <td key={i} style={{padding:"14px 18px",fontSize:14,textAlign:"center",fontWeight:v===minV?700:500,color:v===minV?colors[i]:C.text,background:v===minV?C.accentHl:C.accentBg,borderBottom:`1px solid ${C.borderMid}`,borderTop:`2px solid ${C.borderMid}`,whiteSpace:"nowrap",fontFamily:F.body}}>{brl(v)}</td>
                      ))}
                    </tr>
                  );
                })()}

                <SectionHeader label="Crédito recebido"/>
                <Row label="Valor financiado / carta de crédito" sub="SAC e Price: imediato · Consórcio: carta reajustada na contemplação" sac={principal} price={principal} cons={ct.cartaTravada} even={false}/>
                <Row label="Acesso ao imóvel" sac="Mês 1" price="Mês 1" cons={`Mês ${cmSafe} (estimativa)`} even/>
                {(()=>{
                  const vals=[sacPct,pricePct,consPct];
                  const minV=Math.min(...vals);
                  const colors=[C.sac,C.price,C.cons];
                  return (
                    <tr style={{background:"#fafcfa"}}>
                      <td style={{padding:"12px 18px",fontSize:13,color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:F.body}}>
                        <div style={{fontWeight:700}}>Custo puro % do crédito recebido</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:2}}>(Juros+TR) ÷ principal · (Adm+Fundo+Indexador) ÷ carta reajustada</div>
                      </td>
                      {vals.map((v,i)=>(
                        <td key={i} style={{padding:"12px 18px",fontSize:13,textAlign:"center",fontWeight:v===minV?700:400,color:v===minV?colors[i]:C.text,background:v===minV?C.accentHl:"transparent",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",fontFamily:F.body}}>{v.toFixed(1)}%</td>
                      ))}
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* GRÁFICOS */}
        <ChartCard title="Evolução das parcelas" subtitle="Parcela mensal em cada modalidade ao longo do tempo.">
          <ResponsiveContainer>
            <LineChart data={chartParcelas}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontFamily:F.body,fontSize:12}}/>
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"Contemplação",fill:C.cons,fontSize:10,fontFamily:F.body}}/>
              <Line type="monotone" dataKey="SAC"       stroke={C.sac}   strokeWidth={2.5} dot={false} strokeLinecap="round"/>
              <Line type="monotone" dataKey="Price"     stroke={C.price} strokeWidth={2.5} dot={false} strokeLinecap="round"/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons}  strokeWidth={2.5} dot={false} strokeLinecap="round"/>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Desembolso total acumulado" subtitle="Tudo que saiu do bolso acumulado mês a mês (parcelas + entrada/lance + aluguel).">
          <ResponsiveContainer>
            <LineChart data={chartDesembolso}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontFamily:F.body,fontSize:12}}/>
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"Contemplação",fill:C.cons,fontSize:10,fontFamily:F.body}}/>
              <Line type="monotone" dataKey="SAC"       stroke={C.sac}   strokeWidth={2.5} dot={false} strokeLinecap="round"/>
              <Line type="monotone" dataKey="Price"     stroke={C.price} strokeWidth={2.5} dot={false} strokeLinecap="round"/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons}  strokeWidth={2.5} dot={false} strokeLinecap="round"/>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Patrimônio líquido ao longo do tempo" subtitle="Valor do imóvel reajustado menos saldo devedor. Consórcio parte do zero — patrimônio existe só após a contemplação.">
          <ResponsiveContainer>
            <LineChart data={chartPatrimonio}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <YAxis tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fontFamily:F.body,fill:C.muted}}/>
              <Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontFamily:F.body,fontSize:12}}/>
              <ReferenceLine x={cmSafe} stroke={C.cons} strokeDasharray="5 4" label={{value:"Contemplação",fill:C.cons,fontSize:10,fontFamily:F.body}}/>
              <Line type="monotone" dataKey="SAC"       stroke={C.sac}   strokeWidth={2.5} dot={false} strokeLinecap="round"/>
              <Line type="monotone" dataKey="Price"     stroke={C.price} strokeWidth={2.5} dot={false} strokeLinecap="round"/>
              <Line type="monotone" dataKey="Consórcio" stroke={C.cons}  strokeWidth={2.5} dot={false} strokeLinecap="round"/>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* NOTA */}
        <div style={{background:C.goldBg,border:"1px solid #e8d48a",borderRadius:12,padding:"14px 18px",fontSize:12,color:"#6b4f10",lineHeight:1.7,fontFamily:F.body}}>
          <strong>Premissas:</strong> imóvel reajustado pelo indexador do consórcio. Antes da contemplação o patrimônio do consórcio é zero — a carta é uma promessa de crédito, não um ativo. Não considera FGTS no patrimônio, benfeitorias ou variações de mercado acima do indexador. O mês de contemplação é uma estimativa.
        </div>

      </div>
    </div>
  );
}
