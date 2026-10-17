import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import{getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,onAuthStateChanged,signOut,updateProfile,reauthenticateWithCredential,EmailAuthProvider}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{getFirestore,doc,getDoc,setDoc,collection,addDoc,getDocs,query,where,limit,serverTimestamp,updateDoc,runTransaction,writeBatch}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const cfg={
  apiKey:"AIzaSyB4bpo6md65Us-eKFDZtTQktNTMlosMwfQ",
  authDomain:"easy-earn-platform.firebaseapp.com",
  projectId:"easy-earn-platform",
  storageBucket:"easy-earn-platform.firebasestorage.app",
  messagingSenderId:"547908408028",
  appId:"1:547908408028:web:0078ab9905e36d96ad1a19"
};

// IMPORTANT: PASTE YOUR REAL ADMIN UID BELOW.
const ADMIN_UID="PASTE_ADMIN_USER_UID";

const app=initializeApp(cfg);
const auth=getAuth(app);
const db=getFirestore(app);

let user,mode="login",vips=[],tasks=[],subs=[],txs=[],reqs=[];
let company={
  title:"About Easy Earn",
  description:"Easy Earn provides a member portal for viewing task instructions, submitting work for review and tracking account activity. Review all membership terms before participating.",
  supportUrl:"https://t.me/easy_earn10"
};
let member={balance:0,vipLevel:0},filter="all";

const $=x=>document.getElementById(x);
const admin=()=>user&&ADMIN_UID!=="PASTE_ADMIN_USER_UID"&&user.uid===ADMIN_UID;
const eur=n=>"€"+Number(n||0).toFixed(2);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=t=>t?.toDate?t.toDate().toLocaleString():"Just now";

function toast(s){
  $("toast").textContent=s;
  $("toast").classList.add("show");
  setTimeout(()=>$("toast").classList.remove("show"),2700);
}

function say(id,s,ok=false){
  $(id).textContent=s;
  $(id).style.color=ok?"#246c4e":"#b53d36";
}

function friendly(e){
  let c=e?.code||"";
  if(c.includes("email-already-in-use"))return"An account already exists with this email.";
  if(c.includes("invalid-credential")||c.includes("wrong-password"))return"Email or password is incorrect.";
  if(c.includes("permission-denied"))return"Permission denied. Check Firestore Rules and admin UID.";
  return e?.message||"Something went wrong.";
}

function authmode(m){
  mode=m;
  $("loginTab").classList.toggle("sel",m==="login");
  $("regTab").classList.toggle("sel",m==="register");
  $("namebox").classList.toggle("hide",m!=="register");
  $("forgot").classList.toggle("hide",m!=="login");
  $("authsubmit").textContent=m==="login"?"Sign in":"Create account";
  $("authmsg").textContent="";
}

$("loginTab").onclick=()=>authmode("login");
$("regTab").onclick=()=>authmode("register");

$("authform").onsubmit=async e=>{
  e.preventDefault();
  try{
    let email=$("email").value.trim(),pw=$("password").value;
    if(mode==="register"){
      let name=$("name").value.trim();
      if(!name)throw Error("Enter your full name.");
      let c=await createUserWithEmailAndPassword(auth,email,pw);
      await updateProfile(c.user,{displayName:name});
      await setDoc(doc(db,"users",c.user.uid),{
        name,email,balance:0,vipLevel:0,
        createdAt:serverTimestamp(),status:"active"
      });
    }else{
      await signInWithEmailAndPassword(auth,email,pw);
    }
  }catch(e){
    say("authmsg",friendly(e));
  }
};

$("forgot").onclick=async()=>{
  if(!$("email").value.trim())return say("authmsg","Enter your email address first.");
  try{
    await sendPasswordResetEmail(auth,$("email").value.trim());
    say("authmsg","Password reset email sent. Check your inbox.",true);
  }catch(e){
    say("authmsg",friendly(e));
  }
};

$("logout").onclick=()=>signOut(auth);
$("menu").onclick=()=>$("sidebar").classList.toggle("open");

function show(p){
  if(p==="admin"&&!admin())return toast("Admin access required.");
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hide"));
  $(p).classList.remove("hide");
  $("crumb").textContent=p==="admin"?"Admin panel":p[0].toUpperCase()+p.slice(1);
  document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===p));
  $("sidebar").classList.remove("open");
  if(p==="history")renderHistory();
  if(p==="admin")loadAdmin().catch(e=>toast(friendly(e)));
}

document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>show(b.dataset.page));

function support(){
  const url=company.supportUrl&&/^https?:\/\//i.test(company.supportUrl)
    ?company.supportUrl
    :"https://t.me/easy_earn10";
  window.open(url,"_blank","noopener,noreferrer");
}

["supportSide","supportTask","supportAccount"].forEach(id=>{
  $(id).onclick=support;
});

$("floatSupport").onclick=e=>{
  e.preventDefault();
  support();
};

$("method").onchange=()=>{
  $("usdtfields").classList.toggle("hide",$("method").value!=="usdt");
  $("visafields").classList.toggle("hide",$("method").value!=="visa");
};

$("resetpass").onclick=async()=>{
  try{
    await sendPasswordResetEmail(auth,user.email);
    toast("Password reset email sent.");
  }catch(e){
    toast(friendly(e));
  }
};

onAuthStateChanged(auth,async u=>{
  user=u;
  $("auth").classList.toggle("hide",!!u);
  $("app").classList.toggle("hide",!u);
  if(!u)return;

  try{
    let ur=doc(db,"users",u.uid),us=await getDoc(ur);
    if(!us.exists()){
      await setDoc(ur,{
        name:u.displayName||"",
        email:u.email,
        balance:0,
        vipLevel:0,
        createdAt:serverTimestamp()
      });
    }

    if(admin()&&!document.querySelector('[data-page="admin"]')){
      let b=document.createElement("button");
      b.dataset.page="admin";
      b.textContent="⚙ Admin panel";
      $("nav").append(b);
      b.onclick=()=>show("admin");
    }

    await load();
    show(admin()?"admin":"home");
  }catch(e){
    toast(friendly(e));
  }
});

async function all(c){
  let s=await getDocs(query(collection(db,c),limit(500)));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

async function load(){
  let [u,t,s,x,r,v,c]=await Promise.all([
    getDoc(doc(db,"users",user.uid)),
    all("tasks"),
    getDocs(query(collection(db,"submissions"),where("userId","==",user.uid),limit(300))),
    getDocs(query(collection(db,"transactions"),where("userId","==",user.uid),limit(300))),
    getDocs(query(collection(db,"paymentRequests"),where("userId","==",user.uid),limit(200))),
    all("vipPlans"),
    getDoc(doc(db,"settings","company"))
  ]);

  member=u.exists()?u.data():{balance:0,vipLevel:0};
  tasks=t;
  subs=s.docs.map(d=>({id:d.id,...d.data()}));
  txs=x.docs.map(d=>({id:d.id,...d.data()}));
  reqs=r.docs.map(d=>({id:d.id,...d.data()}));

  if(v.length)vips=v.sort((a,b)=>a.level-b.level);
  else vips=Array.from({length:10},(_,i)=>({
    id:String(i+1),level:i+1,name:"VIP "+(i+1),
    upgradeAmount:(i+1)*10,dailyCommission:0,active:true
  }));

  if(c.exists())company={...company,...c.data()};
  render();
}

function render(){
  let name=user.displayName||member.name||user.email.split("@")[0];
  $("welcome").textContent=name;
  $("userlabel").textContent=name;
  $("balance").textContent=eur(member.balance);
  $("profilebalance").textContent=eur(member.balance);
  $("profileemail").textContent=user.email;
  $("profilevip").textContent=member.vipLevel?"VIP "+member.vipLevel:"Standard";
  $("year").textContent=new Date().getFullYear();
  $("companytitle").textContent=company.title;
  $("companydesc").textContent=company.description;

  renderVips();
  renderTasks();
  renderHistory();

  $("recent").innerHTML=[
    ...subs.map(s=>({
      title:s.taskTitle,
      desc:"Task · "+s.status,
      dt:s.createdAt,
      amount:s.status==="approved"?s.reward:0
    })),
    ...txs.map(t=>({
      title:t.description,
      desc:"Transaction",
      dt:t.createdAt,
      amount:t.amount
    }))
  ].sort((a,b)=>(b.dt?.seconds||0)-(a.dt?.seconds||0))
   .slice(0,5)
   .map(i=>`<div class="item"><div><b>${esc(i.title)}</b><small>${esc(i.desc)} · ${date(i.dt)}</small></div><b>${i.amount?eur(i.amount):"—"}</b></div>`)
   .join("")||'<div class="card">No recent activity.</div>';
}

function renderVips(){
  $("vipgrid").innerHTML=vips.filter(v=>v.active!==false).map(v=>`
    <div class="vip">
      <small>MEMBERSHIP LEVEL</small>
      <h3>${esc(v.name||"VIP "+v.level)}</h3>
      <strong>${eur(v.upgradeAmount)}</strong>
      <small> upgrade amount</small>
      <p>Daily commission display: <b>${eur(v.dailyCommission)}</b><br>Up to five tasks assigned to this level.</p>
      <button class="btn main wide" data-vip="${v.level}">Contact support to upgrade</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-vip]").forEach(b=>b.onclick=support);

  $("newvip").innerHTML=vips.map(v=>`<option value="${v.level}">VIP ${v.level}</option>`).join("");
  $("taskfilter").innerHTML='<option value="all">All VIP levels</option>'+vips.map(v=>`<option value="${v.level}">VIP ${v.level}</option>`).join("");
}

function renderTasks(){
  let f=$("taskfilter").value||"all";
  let arr=tasks.filter(t=>t.active!==false&&(f==="all"||Number(t.vipLevel)===Number(f)));

  $("taskgrid").innerHTML=arr.map(t=>`
    <div class="task">
      <small>VIP ${t.vipLevel||1} · ${eur(t.reward)}</small>
      <h3>${esc(t.title)}</h3>
      <p>${esc(t.description)}</p>
      <button class="btn outline" data-open="${t.id}">Open task ↗</button>
      <button class="btn main" data-submit="${t.id}">Submit completion</button>
    </div>
  `).join("")||'<div class="card">No tasks available.</div>';

  document.querySelectorAll("[data-open]").forEach(b=>b
