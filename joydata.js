(function(){
  const agents=["Naushad","Obina","Vani"];
  const sectors=["Trading","Contracting","Technical Services","Tourism","Restaurant","Building Materials","Interior Design","General Maintenance","Business Services","Real Estate"];
  const areas=["Dubai","Sharjah","Ajman","Abu Dhabi","Ras Al Khaimah"];
  const contacts=["Mr Ahmed","Ms Priya","Mr Sameer","Ms Noura","Mr Khalid","Ms Sara","Mr Daniel","Ms Asha","Mr Omar","Ms Lina"];
  const statuses=["No answer","Not interested","FollowUp","Using etisalat","Using DU","Voicemail","Number not in use","Interested"];
  const remarks=[
    "Call back next week",
    "Asked for plan details on WhatsApp",
    "Currently under contract",
    "No requirement this month",
    "Using competitor connection",
    "Requested email proposal",
    "Decision maker unavailable",
    "Interested in business internet and SIMs"
  ];
  const rows=[];
  for(let i=0;i<180;i++){
    const agent=agents[i%agents.length];
    const d=new Date(2026,2+(i%4),1+(i%27));
    const status=statuses[i%statuses.length];
    const co=`${areas[i%areas.length]} ${sectors[i%sectors.length]} ${String(i+1).padStart(3,"0")} LLC`;
    rows.push({
      a:agent,
      d:d.toISOString().slice(0,10),
      co,
      cn:"9715"+String(50000000+i*137).slice(0,8),
      cu:contacts[i%contacts.length],
      s:status,
      r:remarks[i%remarks.length],
      x:(status==="No answer"||status==="Voicemail"||status==="Number not in use")?"NO":"YES"
    });
  }
  // A few deliberate duplicate contacts demonstrate the duplicate warning flow.
  rows.push({...rows[4],a:"Vani",d:"2026-06-24",r:"Duplicate demo contact for coaching"});
  rows.push({...rows[17],a:"Obina",d:"2026-06-25",r:"Duplicate demo contact for TL review"});
  window.JOY_IMPORT=rows;
})();