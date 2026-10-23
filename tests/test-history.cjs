const fs=require('fs'),vm=require('vm');
const elements={},el=k=>elements[k]??={innerHTML:'',textContent:'',style:{},showModal(){this.open=true},close(){this.open=false},insertAdjacentHTML(){},elements:{kind:{value:'reading'},container:{value:''}}};
const context=vm.createContext({document:{querySelector:el},localStorage:{getItem:()=>null,setItem(){},length:0},crypto:require('crypto').webcrypto,console,setTimeout(){},window:{scrollTo(){}},FormData:class{constructor(v){this.v=v}get(k){return this.v[k]??''}getAll(k){return Array.isArray(this.v[k])?this.v[k]:this.v[k]?[this.v[k]]:[]}}});
for(const name of ['timeline-dates.js','history.js','app.js'])vm.runInContext(fs.readFileSync('../app/src/main/assets/www/'+name,'utf8'),context);
vm.runInContext(fs.readFileSync('history-cases.js','utf8'),context).catch(e=>{console.error(e);process.exitCode=1});
