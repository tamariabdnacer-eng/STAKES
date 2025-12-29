firebase.initializeApp({
  apiKey:"AIzaSyAM7gLKuLRfhFdWyakFS1jU4c8xU1fg-FU",
  authDomain:"family-bank-966ae.firebaseapp.com",
  databaseURL:"https://family-bank-966ae-default-rtdb.firebaseio.com",
  projectId:"family-bank-966ae"
});

const db = firebase.database();
let currentUser = null;
let pendingAmount = 0;
let pendingWithdraw = 0; // 💡 لمبلغ السحب المخصص

const coinSound = new Audio('coin.mp3');

// ----------------- Remember Me AUTO LOGIN -----------------
window.addEventListener("load", ()=>{
  let saved = localStorage.getItem("stakeRemember");
  if(saved){
    currentUser = saved;
    loginBox.style.display="none";
    mainDiv.style.display="block";
    profileUsername.innerText = currentUser;
    checkCard();
    loadBalance();
    monitorHistory();
  }
});

function playCoinSound(){
    coinSound.currentTime = 0;
    coinSound.play().catch(()=>{});
}

// ----------------- UI Helpers -----------------
function hideAll(){
  loginBox.style.display = "none";
  registerBox.style.display = "none";
  resetBox.style.display = "none";
}
function showLogin(){ hideAll(); loginBox.style.display="block"; }
function showRegister(){ hideAll(); registerBox.style.display="block"; }
function showReset(){ hideAll(); resetBox.style.display="block"; }
function showProfile(){ profileDiv.style.display="block"; gamesDiv.style.display="none"; }
function showGames(){ profileDiv.style.display="none"; gamesDiv.style.display="block"; }

function logout(){
  localStorage.removeItem("stakeRemember");
  location.reload();
}

// ----------------- Register/Login/Reset -----------------
function register(){
  let u = regUser.value.trim().toLowerCase();
  let p = regPass.value.trim();
  let pin = regPin.value.trim();
  if(!u || !p || pin.length!==5){ regMsg.innerText="❌ املأ البيانات صح"; return; }

  db.ref("userStake/"+u).once("value").then(s=>{
    if(s.exists()){ regMsg.innerText="❌ المستخدم موجود"; return; }
    db.ref("userStake/"+u).set({password:p, pin:pin, balance:0, history:[]})
      .then(()=>{ regMsg.innerText="✅ تم إنشاء الحساب"; });
  });
}

function login(){
  let u = loginUser.value.trim().toLowerCase();
  let p = loginPass.value.trim();
  if(!u||!p){ loginMsg.innerText="❌ املأ البيانات"; return; }

  db.ref("userStake/"+u).once("value").then(s=>{
    let d = s.val();
    if(!d || d.password!==p){ loginMsg.innerText="❌ خطأ"; return; }

    currentUser = u;
    if(document.getElementById("rememberMe").checked){
      localStorage.setItem("stakeRemember", currentUser);
    }

    loginBox.style.display="none";
    mainDiv.style.display="block";
    profileUsername.innerText = currentUser;

    checkCard();
    loadBalance();
    monitorHistory();
  });
}

function resetPassword(){
  let u = resetUser.value.trim().toLowerCase();
  let pin = resetPin.value.trim();
  let np = newPass.value.trim();

  db.ref("userStake/"+u).once("value").then(s=>{
    let d = s.val();
    if(!d || d.pin!==pin){ resetMsg.innerText="❌ بيانات خاطئة"; return; }
    db.ref("userStake/"+u).update({password:np});
    resetMsg.innerText="✅ تم تغيير كلمة السر";
  });
}

// ----------------- Card -----------------
function checkCard(){
  db.ref("userStake/"+currentUser).once("value").then(s=>{
    let d = s.val()||{};
    if(d.cardNumber){
      cardRegister.style.display="none";
      cardDone.style.display="block";
    } else {
      cardRegister.style.display="block";
      cardDone.style.display="none";
    }
  });
}

function saveCardInfo(){
  let card = stakeCard.value.trim();
  let cvv = stakeCvv.value.trim();
  if(!card||!cvv){ msgCard.innerText="❌ أكمل البيانات"; return; }

  db.ref("userStake/"+currentUser).update({cardNumber:card, cvv:cvv})
    .then(()=>{
      msgCard.innerText = "✅ تم الحفظ";
      cardRegister.style.display = "none";
      cardDone.style.display = "block";
    });
}

// ----------------- Balance -----------------
function loadBalance(){
  db.ref("userStake/"+currentUser).once("value").then(s=>{
    let u = s.val();
    balanceDisplay.innerText = (u.balance||0)+"$";
  });
}

function animateBalance(target) {
  const display = document.getElementById("balanceDisplay");
  let current = Number(display.innerText.replace("$","")) || 0;
  const step = (target - current) / 30;
  let i = 0;
  const interval = setInterval(()=>{
    if(i < 30){
      current += step;
      display.innerText = Math.round(current) + "$";
      i++;
    } else {
      display.innerText = target + "$";
      clearInterval(interval);
    }
  }, 15);
}

// ----------------- History -----------------
function monitorHistory(){
  db.ref("userStake/"+currentUser+"/history").on('value', snap=>{
    let hBox = document.getElementById("history");
    hBox.innerHTML="";
    (snap.val()||[]).forEach(op=>{
      let p = document.createElement("p");
      p.innerText = op;
      if(op.includes("Deposit")) p.classList.add("deposit");
      if(op.includes("Withdraw")) p.classList.add("withdraw");
      hBox.appendChild(p);
    });
  });
}

// ----------------- Recharge -----------------
function openConfirmModal(a){
  pendingAmount = a;
  confirmText.innerText = `هل تريد شحن ${a}$ ؟`;
  confirmModal.style.display = "flex";
}
function cancelRecharge(){ confirmModal.style.display = "none"; }
function confirmRecharge(){
  confirmModal.style.display = "none";
  rechargeFixed(pendingAmount);
  pendingAmount = 0;
}

function rechargeFixed(amount){
  if(!currentUser) return;

  db.ref("userStake/"+currentUser).once("value").then(s=>{
    let u = s.val()||{};
    if(!u.cardNumber || !u.cvv){ msgRecharge.innerText="❌ اربط البطاقة أولاً"; return; }

    db.ref("users").once("value").then(bankSnap=>{
      let bank = bankSnap.val()||{};
      let owner = null;
      for(let x in bank){
        if(bank[x].cardNumber === u.cardNumber && bank[x].cvv == u.cvv){ owner=x; break; }
      }
      if(!owner){ msgRecharge.innerText="❌ بطاقة البنك غير موجود"; return; }

      let bankBalance = Number(bank[owner].balance || 0);
      if(bankBalance < amount){ 
        msgRecharge.innerText="❌ رصيد البنك غير كافي"; 
        return; 
      }

      db.ref("users/"+owner+"/balance").transaction(b=>{
        return (Number(b)||0) - amount;
      }).then(()=>{
        db.ref("userStake/"+currentUser).transaction(d=>{
          if(!d) d={balance:0, history:[]};
          d.balance = (d.balance||0) + amount;
          if(!d.history) d.history=[];
          d.history.push("💰 Deposit +"+amount+"$");
          return d;
        }).then((res)=>{
          animateBalance(res.snapshot.val().balance);
          playCoinSound();
          msgRecharge.innerText="✅ تم شحن "+amount+"$ بنجاح";

          db.ref("users/"+owner+"/history").transaction(h=>{
            if(!h) h=[];
            h.push(`💰 خصم ${amount}$ لصالح ${currentUser}`);
            return h;
          });
        });

      }).catch(()=>{ msgRecharge.innerText="❌ خطأ"; });

    });
  });
}

// ----------------- Withdraw Fixed -----------------
function withdrawFixed(amount){
  processWithdraw(amount);
}

// ----------------- Withdraw Custom مع تأكيد -----------------
function withdrawCustom(){
  let input = prompt("أدخل المبلغ الذي تريد سحبه:");
  let amount = Number(input);
  if(isNaN(amount) || amount <= 0){
    msgWithdraw.innerText = "❌ أدخل مبلغ صالح";
    return;
  }
  pendingWithdraw = amount;
  if(confirm(`هل تريد سحب ${amount}$ من رصيدك؟`)){
    processWithdraw(pendingWithdraw);
    pendingWithdraw = 0;
  }
}

// ----------------- Process Withdraw (مشترك) -----------------
function processWithdraw(amount){
  db.ref("userStake/"+currentUser).once("value").then(s=>{
    let u = s.val()||{};
    if(!u.cardNumber){ msgWithdraw.innerText="❌ اربط البطاقة"; return; }
    if(u.balance<amount){ msgWithdraw.innerText="❌ رصيد غير كافي"; return; }

    db.ref("users").once("value").then(bankSnap=>{
      let bank = bankSnap.val()||{};
      let owner = null;
      for(let x in bank){
        if(bank[x].cardNumber === u.cardNumber && bank[x].cvv==u.cvv){ owner=x; break; }
      }
      if(!owner){ msgWithdraw.innerText="❌ بطاقة غير موجودة"; return; }

      db.ref("userStake/"+currentUser).transaction(d=>{
        if(d.balance<amount) return d;
        d.balance -= amount;
        d.history.push("💸 Withdraw -"+amount+"$");
        return d;
      }).then((res)=>{
        animateBalance(res.snapshot.val().balance);
        playCoinSound();
        msgWithdraw.innerText="✅ تمت العملية";

        db.ref("users/"+owner+"/balance").transaction(b=>(Number(b||0)+amount));
        db.ref("users/"+owner+"/history").transaction(h=>{
          if(!h) h=[];
          h.push(`💸 استلام ${amount}$ من ${currentUser}`);
          return h;
        });
      });
    });
  });
      }
