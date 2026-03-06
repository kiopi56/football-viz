import{s}from"./index-_Qoxd6H3.js";async function m(a,r){const{data:e,error:t}=await s.from("match_records").select("*").eq("user_id",a).eq("fixture_id",r).maybeSingle();if(t)throw t;return e??null}async function u(a,r,{watched:e,rating:t,memo:i,mom:n}){const{data:c,error:o}=await s.from("match_records").upsert({user_id:a,fixture_id:r,watched:e??!1,rating:t||null,memo:i||null,mom:n||null},{onConflict:"user_id,fixture_id"}).select().single();if(o)throw o;return c}async function _(a){const{data:r,error:e}=await s.from("match_records").select(`
      *,
      fixture:fixtures (
        id, home_team_name, away_team_name,
        home_team_id, away_team_id,
        goals_home, goals_away,
        match_date, season
      )
    `).eq("user_id",a).eq("watched",!0).order("created_at",{ascending:!1});if(e)throw e;return r??[]}export{_ as a,m as g,u as s};
