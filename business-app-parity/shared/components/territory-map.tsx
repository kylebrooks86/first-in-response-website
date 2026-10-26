'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Map as GLMap,GeoJSONSource,StyleSpecification} from 'maplibre-gl';
import {territoryCardStatus,TERRITORY_CATEGORIES,TERRITORY_VIEW_KEY,TERRITORY_DEFAULT_VIEW,validTerritoryView,territoryPlaces,territoryVisible,territoryGeoJSON,validTerritoryRecords,type TerritoryPlace,type TerritoryRecords} from '../lib/territory';
import {houseKey,doorSuppressed,doorTodayInTulsa,validDoorFollowUpDate,type DoorBook,type DoorPoint} from '../lib/door-knocking';
const AUTO_FIND_KEY='fire-territory-autofind-customers-v1';
const MAP_STYLE_KEY='fire-territory-basemap-v1';
type BaseStyle='street'|'aerial';
const STREET_STYLE='https://tiles.openfreemap.org/styles/liberty';
const USGS_TILE='https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';
// USGS The National Map: public-domain aerial orthoimagery. Online only; not an offline download.
const usgsAerialStyle=():StyleSpecification=>({
 version:8,
 sources:{'usgs-aerial':{type:'raster',tiles:[USGS_TILE],tileSize:256,maxzoom:16,attribution:'<a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map / USDA</a>'}},
 layers:[{id:'usgs-aerial-image',type:'raster',source:'usgs-aerial'}]
});
const selectedBaseStyle=(online:boolean,mode:BaseStyle):StyleSpecification|string=>online?(mode==='aerial'?usgsAerialStyle():STREET_STYLE):offlinePinStyle();
const offlinePinStyle=():StyleSpecification=>({version:8,sources:{},layers:[{id:'offline-pin-background',type:'background',paint:{'background-color':'#e5eceb'}}]});
type Props={online?:boolean;focusAddress?:string|null;onFocusAddressHandled?:(address:string)=>void;book:DoorBook;disabled:boolean;save:(details:Record<string,unknown>)=>Promise<void>;onOpenCustomer?:(id:string)=>void;onOpenHouse:(id:string)=>void;onCreateCustomer?:(address:string)=>void};
export function TerritoryMap({online=true,focusAddress,onFocusAddressHandled,book,disabled,save,onOpenCustomer,onOpenHouse,onCreateCustomer}:Props){
 const host=useRef<HTMLDivElement>(null),map=useRef<GLMap|null>(null),alive=useRef(true),recordsRequest=useRef(0),styleOnline=useRef<boolean|null>(null),appliedBase=useRef<BaseStyle|null>(null),onlineRef=useRef(online),baseRef=useRef<BaseStyle>('street');onlineRef.current=online;
 const [records,setRecords]=useState<TerritoryRecords>({customers:[],jobs:[]}),[recordError,setRecordError]=useState(''),[mapError,setMapError]=useState(''),[ready,setReady]=useState(false),[filter,setFilter]=useState('all'),[selected,setSelected]=useState<string|null>(null),[query,setQuery]=useState(''),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState(''),[draft,setDraft]=useState<{point:DoorPoint;address:string;matched?:string;source?:'auto'}|null>(null),[note,setNote]=useState(''),[revisitOpen,setRevisitOpen]=useState(false),[revisitDate,setRevisitDate]=useState(''),[legend,setLegend]=useState(false),[showPlaces,setShowPlaces]=useState(false),[moreFilters,setMoreFilters]=useState(false),[listLimit,setListLimit]=useState(60),[placeQuery,setPlaceQuery]=useState(''),[expanded,setExpanded]=useState(false),[autoFind,setAutoFind]=useState(false),[baseStyle,setBaseStyle]=useState<BaseStyle>('street');
 baseRef.current=baseStyle;
 useEffect(()=>{try{if(sessionStorage.getItem(MAP_STYLE_KEY)==='aerial')setBaseStyle('aerial');}catch{/* Storage optional. */}},[]);
 const chooseBase=(mode:BaseStyle)=>{setBaseStyle(mode);try{sessionStorage.setItem(MAP_STYLE_KEY,mode);}catch{/* Style switch still works. */}};
 const autoAttempts=useRef(new Set<string>());
 useEffect(()=>{try{setAutoFind(sessionStorage.getItem(AUTO_FIND_KEY)==='on');}catch{/* No persistent setting in private browsing. */}},[]);
 const changeAutoFind=(next:boolean)=>{autoAttempts.current.clear();setAutoFind(next);try{sessionStorage.setItem(AUTO_FIND_KEY,next?'on':'off');}catch{/* Map still works. */}};
 const today=doorTodayInTulsa();
 const places=useMemo(()=>territoryPlaces(book,records),[book,records]),visible=useMemo(()=>territoryVisible(places,filter,today),[places,filter,today]),unknownOffline=!online&&!records.customers.length&&!records.jobs.length,geo=useMemo(()=>{const data=territoryGeoJSON(visible,today);return unknownOffline?{...data,features:data.features.map(f=>({...f,properties:{...f.properties,label:f.properties.color==='#334155'?'Status unavailable offline':f.properties.label}}))}:data;},[visible,unknownOffline,today]);
 const listedPlaces=useMemo(()=>{const q=placeQuery.trim().toLocaleLowerCase();return q?visible.filter(p=>p.address.toLocaleLowerCase().includes(q)||p.customers.some(c=>c.name.toLocaleLowerCase().includes(q))):visible;},[visible,placeQuery]);
 const geoRef=useRef(geo);geoRef.current=geo;
 const pinStatus=(p:TerritoryPlace)=>unknownOffline&&!p.category?'Status unavailable offline':territoryCardStatus(p);
 const current=places.find(p=>p.key===selected)??null;
 const selectRef=useRef((key:string)=>{setSelected(key);setDraft(null);setNote('');});
 const loadRecords=async()=>{const request=++recordsRequest.current;setRecordError('');if(!online){setRecordError('Offline · saved pins only.');return;}try{const r=await fetch('/api/territory',{cache:'no-store'});if(!alive.current||request!==recordsRequest.current)return;if(r.status===401||r.status===403){setRecords({customers:[],jobs:[]});throw Error('Sign in again to view customer pins.');}const v=await r.json() as TerritoryRecords;if(!r.ok||!validTerritoryRecords(v))throw Error('Customer pins unavailable.');if(alive.current&&request===recordsRequest.current)setRecords(v);}catch(e){if(alive.current&&request===recordsRequest.current)setRecordError(e instanceof Error?e.message:'Customer pins unavailable.');}};
 useEffect(()=>{alive.current=true;void loadRecords();const refresh=()=>{if(online&&document.visibilityState==='visible')void loadRecords();};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{alive.current=false;recordsRequest.current++;window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[online]);
 useEffect(()=>{
  let canceled=false;let instance:GLMap|null=null;let timer:ReturnType<typeof setTimeout>|undefined;let start:{x:number;y:number}|null=null;let ignoreClickUntil=0;let handlersRegistered=false;
  const clear=()=>{if(timer)clearTimeout(timer);timer=undefined;};
  const cancelMove=(e:PointerEvent)=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)clear();};
  const down=(e:PointerEvent)=>{clear();if(!instance||e.button!==0||(e.target as Element).closest('.maplibregl-ctrl'))return;start={x:e.clientX,y:e.clientY};const rect=host.current!.getBoundingClientRect();const point=instance.unproject([e.clientX-rect.left,e.clientY-rect.top]);timer=setTimeout(()=>{if(!canceled){ignoreClickUntil=Date.now()+1200;setDraft({point:{lat:point.lat,lng:point.lng},address:''});setSelected(null);}},650);};
  void import('maplibre-gl').then(lib=>{
   if(canceled||!host.current)return;
   let initialView=TERRITORY_DEFAULT_VIEW;
   try{const stored=sessionStorage.getItem(TERRITORY_VIEW_KEY);const parsed:unknown=stored?JSON.parse(stored):null;if(validTerritoryView(parsed))initialView=parsed;}catch{/* Private browsing/storage denial: use Tulsa default. */}
   instance=new lib.Map({container:host.current,style:selectedBaseStyle(onlineRef.current,baseRef.current),center:[initialView.lng,initialView.lat],zoom:initialView.zoom,maxZoom:19,attributionControl:{compact:true}});map.current=instance;styleOnline.current=onlineRef.current;appliedBase.current=baseRef.current;
   instance.on('moveend',()=>{if(canceled||!instance)return;const c=instance.getCenter();const view={lat:c.lat,lng:c.lng,zoom:instance.getZoom()};if(validTerritoryView(view))try{sessionStorage.setItem(TERRITORY_VIEW_KEY,JSON.stringify(view));}catch{/* Navigation keeps working without storage. */}});
   instance.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
   instance.addControl(new lib.GeolocateControl({positionOptions:{enableHighAccuracy:true},trackUserLocation:false,showAccuracyCircle:true}),'top-right');
   instance.on('style.load',()=>{if(canceled||!instance)return;instance.addSource('fire-places',{type:'geojson',data:geoRef.current,cluster:true,clusterMaxZoom:16,clusterRadius:45});
    instance.addLayer({id:'fire-clusters',type:'circle',source:'fire-places',filter:['has','point_count'],paint:{'circle-color':'#253950','circle-radius':22,'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}});
    if(instance.getStyle().glyphs)instance.addLayer({id:'fire-counts',type:'symbol',source:'fire-places',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':14},paint:{'text-color':'#ffffff'}});
    instance.addLayer({id:'fire-pins',type:'circle',source:'fire-places',filter:['!',['has','point_count']],paint:{'circle-color':['get','color'],'circle-radius':10,'circle-stroke-width':3,'circle-stroke-color':'#ffffff'}});
    instance.addLayer({id:'fire-due-revisits',type:'circle',source:'fire-places',filter:['all',['!',['has','point_count']],['==',['get','revisitDue'],true]],paint:{'circle-color':'rgba(0,0,0,0)','circle-radius':16,'circle-stroke-width':4,'circle-stroke-color':'#d97706'}});
    instance.addLayer({id:'fire-pin-targets',type:'circle',source:'fire-places',filter:['!',['has','point_count']],paint:{'circle-radius':22,'circle-opacity':0}});
    if(!handlersRegistered){handlersRegistered=true;
    instance.on('click','fire-pin-targets',e=>{if(Date.now()<ignoreClickUntil)return;const key=e.features?.[0]?.properties?.key;if(typeof key==='string')selectRef.current(key);});
    instance.on('click','fire-clusters',async e=>{if(Date.now()<ignoreClickUntil)return;const f=e.features?.[0];if(!f||!instance)return;const source=instance.getSource('fire-places') as GeoJSONSource;try{const zoom=await source.getClusterExpansionZoom(Number(f.properties?.cluster_id));if(!canceled&&f.geometry.type==='Point')instance.easeTo({center:f.geometry.coordinates as [number,number],zoom});}catch{}});
    }
    instance.addSource('fire-draft',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    instance.addLayer({id:'fire-draft-point',type:'circle',source:'fire-draft',paint:{'circle-radius':12,'circle-color':'#e12933','circle-stroke-width':4,'circle-stroke-color':'#ffffff'}});
    setReady(true);setMapError('');
   });
   instance.on('error',()=>{if(!canceled)setMapError('Map unavailable. Saved places are still below.');});
   host.current.addEventListener('pointerdown',down);host.current.addEventListener('pointermove',cancelMove);host.current.addEventListener('pointerup',clear);host.current.addEventListener('pointercancel',clear);
   // A second finger must cancel long-press instead of creating a house during pinch zoom.
   host.current.addEventListener('touchstart',multi,{passive:true});
  }).catch(()=>{if(!canceled)setMapError('Map unavailable. Use Saved places.');});
  function multi(e:TouchEvent){if(e.touches.length>1)clear();}
  const element=host.current;return()=>{canceled=true;clear();element?.removeEventListener('pointerdown',down);element?.removeEventListener('pointermove',cancelMove);element?.removeEventListener('pointerup',clear);element?.removeEventListener('pointercancel',clear);element?.removeEventListener('touchstart',multi);instance?.remove();map.current=null;};
 },[]);
 useEffect(()=>{const instance=map.current;if(instance&&(styleOnline.current!==online||appliedBase.current!==baseStyle)){styleOnline.current=online;appliedBase.current=baseStyle;setReady(false);instance.setStyle(selectedBaseStyle(online,baseStyle));}},[online,baseStyle]);
 useEffect(()=>{const id=requestAnimationFrame(()=>map.current?.resize());return()=>cancelAnimationFrame(id);},[expanded]);
 useEffect(()=>{if(ready)(map.current?.getSource('fire-places') as GeoJSONSource|undefined)?.setData(geo);},[ready,geo]);
 useEffect(()=>{if(ready)(map.current?.getSource('fire-draft') as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features:draft?[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[draft.point.lng,draft.point.lat]}}]:[]});},[ready,draft]);
 const selectedLastVisitId=current?.houseId?book.houses.find(h=>h.id===current.houseId)?.visits.at(-1)?.id:null;
 useEffect(()=>{setNote('');setRevisitOpen(false);setRevisitDate('');},[selected,selectedLastVisitId]);
 useEffect(()=>{setListLimit(60);},[filter,placeQuery]);
 const focus=(p:TerritoryPlace)=>{selectRef.current(p.key);if(p.point)map.current?.easeTo({center:[p.point.lng,p.point.lat],zoom:17});};
 // Jump from the saved customer profile; wait for the directory before selecting.
 // A missing coordinate opens the existing address card rather than guessing a pin.
 useEffect(()=>{if(!focusAddress||!ready)return;const place=places.find(p=>p.key===houseKey(focusAddress));if(!place)return;focus(place);if(!place.point)setShowPlaces(true);onFocusAddressHandled?.(focusAddress);},[focusAddress,places,ready,onFocusAddressHandled]);
 const fitSaved=()=>{const instance=map.current;if(!instance||!ready)return;const pinned=visible.filter(p=>p.point).map(p=>p.point!);if(!pinned.length)return;
  if(pinned.length===1){instance.easeTo({center:[pinned[0].lng,pinned[0].lat],zoom:14});return;}
  const minLng=Math.min(...pinned.map(p=>p.lng)),maxLng=Math.max(...pinned.map(p=>p.lng)),minLat=Math.min(...pinned.map(p=>p.lat)),maxLat=Math.max(...pinned.map(p=>p.lat));
  instance.fitBounds([[minLng,minLat],[maxLng,maxLat]],{padding:42,maxZoom:15,duration:0});
 };
 const search=async(address=query,automatic=false,locate=false)=>{
  const entered=address.trim();
  if(searching||!entered)return;
  // Exact saved addresses and customers are local reads, including unpinned homes.
  // Main search stays local for saved customers; Locate and opted-in Auto-find may look up unpinned addresses.
  const localExact=places.find(p=>p.key===houseKey(entered));
  if(localExact&&((!automatic&&!locate)||localExact.point)){setSearchError('');if(!automatic)setFilter('all');focus(localExact);return;}
  if(!automatic&&!locate){
   const normalized=entered.toLocaleLowerCase();
   const exactNames=places.filter(p=>p.customers.some(c=>c.name.trim().toLocaleLowerCase()===normalized));
   const localMatches=exactNames.length?exactNames:normalized.length>=3?places.filter(p=>p.address.toLocaleLowerCase().includes(normalized)||p.customers.some(c=>c.name.toLocaleLowerCase().includes(normalized))):[];
   if(localMatches.length===1){setSearchError('');setFilter('all');focus(localMatches[0]);return;}
   if(localMatches.length>1){setSearchError('');setFilter('all');setPlaceQuery(entered);setShowPlaces(true);setListLimit(60);setSelected(null);return;}
   // New addresses need a street number; a customer's unmatched name never leaves the browser.
   if(!/^(?:[NSEW]\.?\s+)?\d{1,6}\s+[A-Za-z]/i.test(entered)){
    setSearchError('No saved match. Enter a numbered street address to look up a new place.');
    return;
   }
  }
  if(!online){setSearchError('Address lookup needs internet. Use Drop pin.');return;}
  setSearching(true);setSearchError('');
  try{
   const r=await fetch('/api/territory/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address})});
   const v=await r.json() as {matches?:{address:string;point:DoorPoint}[];error?:string};
   if(!r.ok)throw Error(v.error||'Lookup unavailable.');
   const match=v.matches?.[0];
   if(!match)throw Error('No match. Long-press the map to place it.');
   if(!alive.current)return;
   setDraft({point:match.point,address,matched:match.address,...(automatic?{source:'auto' as const}:{})});
   setSelected(null);map.current?.easeTo({center:[match.point.lng,match.point.lat],zoom:17});
  }catch(e){if(alive.current){setSearchError(e instanceof Error?e.message:'Lookup unavailable.');if(automatic)changeAutoFind(false);}}
  finally{if(alive.current)setSearching(false);}
 };
 useEffect(()=>{if(!draft)return;const h=book.houses.find(h=>h.addressKey===houseKey(draft.address));if(h?.location?.point&&h.location.point.lat===draft.point.lat&&h.location.point.lng===draft.point.lng){setSelected(h.addressKey);setDraft(null);}},[book,draft]);
 const existingDraft=draft?places.find(p=>p.key===houseKey(draft.address)):null;
 // Unlocated customer and job addresses need an explicit owner-reviewed lookup.
 const nextUnpinned=listedPlaces.find(p=>!p.point&&p.address.trim());
 const nextCustomerPin=visible.find(p=>p.customers.length>0&&!p.point&&p.address.trim().length>=5&&!autoAttempts.current.has(p.key));
 // Only after owner opt-in: look up one missing customer address, preview, then wait for confirmation.
 useEffect(()=>{if(!autoFind||!online||disabled||!ready||recordError||searching||draft||!nextCustomerPin)return;
  if(autoAttempts.current.has(nextCustomerPin.key))return;
  autoAttempts.current.add(nextCustomerPin.key);
  void search(nextCustomerPin.address,true);
 },[autoFind,online,disabled,ready,recordError,searching,draft,nextCustomerPin?.key]);
 const saveLocation=async()=>{if(!draft||!draft.address.trim())return;const existing=existingDraft;await save(existing?.houseId?{action:'locate',houseId:existing.houseId,point:draft.point}:{action:'add',address:draft.address,point:draft.point});};
 const useMapCenter=()=>{const center=map.current?.getCenter();if(!ready||!center||!Number.isFinite(center.lat)||!Number.isFinite(center.lng))return;setDraft(current=>current?{...current,point:{lat:center.lat,lng:center.lng},matched:undefined}:current);};
 const suppressed=current?.houseId?doorSuppressed(book.houses.find(h=>h.id===current.houseId)!):false;
 return <section className="territory" aria-label="Territory map">
  <form className="territory-search" onSubmit={e=>{e.preventDefault();void search();}}><input aria-label="Search address or saved customer" value={query} maxLength={240} placeholder="Address or saved customer" onChange={e=>setQuery(e.target.value)}/><button disabled={searching||!query.trim()}>Find</button></form>
  <div className="territory-basemap" role="group" aria-label="Map imagery"><button type="button" aria-pressed={baseStyle==='street'} onClick={()=>chooseBase('street')}>Street</button><button type="button" aria-pressed={baseStyle==='aerial'} disabled={!online} onClick={()=>chooseBase('aerial')}>Aerial</button>{!online&&<small>Offline pins only</small>}</div>
  <div className="territory-filter-wrap">
   <div className="territory-filters" role="group" aria-label="Map filters">
    <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All</button>
    <button type="button" aria-pressed={filter==='customer'} onClick={()=>setFilter('customer')}>Customers</button>
    <button type="button" aria-pressed={filter==='revisits-due'} onClick={()=>setFilter('revisits-due')}>Due · {places.filter(p=>p.revisitOn&&p.revisitOn<=today).length}</button>
    <button type="button" aria-label="More map filters" aria-controls="territory-extra-filters" aria-expanded={moreFilters} onClick={()=>setMoreFilters(!moreFilters)}>{moreFilters?'Less':filter!=='all'&&filter!=='customer'&&filter!=='revisits-due'?'More · Active':'More'}</button>
   </div>
   {moreFilters&&<div id="territory-extra-filters" className="territory-extra-filters" role="group" aria-label="Additional map filters">
    {Object.entries(TERRITORY_CATEGORIES).filter(([key])=>key!=='customer').map(([key,c])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{c.filter}</button>)}
    <button type="button" aria-pressed={filter==='needs-pins'} onClick={()=>{setFilter('needs-pins');setShowPlaces(true);}}>Needs pins · {places.filter(p=>!p.point&&p.address.trim()).length}</button>
     <button type="button" aria-pressed={filter==='revisits'} onClick={()=>setFilter('revisits')}>Revisits</button>
   </div>}
  </div>
  {recordError&&<p role={online?"alert":"status"}>{recordError} {online&&<button type="button" onClick={()=>void loadRecords()}>Retry</button>}</p>}
  {searchError&&<p role="alert">{searchError}</p>}
  <div className={"territory-stage"+(expanded?" territory-expanded":"")}><div ref={host} className="territory-canvas" aria-label="Tulsa street map"/>
   <div className="territory-legend"><button type="button" aria-expanded={legend} onClick={()=>setLegend(!legend)}>Legend</button>{legend&&<ul>{Object.entries(TERRITORY_CATEGORIES).map(([key,c])=><li key={key}><i style={{background:c.color}}/><span>{c.label}</span><b>{visible.filter(p=>p.point&&p.category===key).length}</b></li>)}<li><i style={{background:'#334155'}}/><span>{unknownOffline?'Status unavailable':'Not visited'}</span><b>{visible.filter(p=>p.point&&!p.category).length}</b></li><li><i className="territory-revisit-key"/><span>Gold outline · revisit due</span><b>{visible.filter(p=>p.point&&p.revisitOn&&p.revisitOn<=today).length}</b></li></ul>}</div>
   <span className="territory-crosshair" aria-hidden="true">+</span><button type="button" className="territory-expand" aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?"Done":"Expand"}</button>
   <button type="button" className="territory-overview" onClick={()=>map.current?.fitBounds([[-96.48,35.8],[-95.52,36.55]],{padding:24,maxZoom:11,duration:0})} disabled={!ready} aria-label="Show Tulsa and surrounding towns">Tulsa area</button>
   <button type="button" className="territory-drop" onClick={()=>{const center=map.current?.getCenter();if(center){setDraft({point:{lat:center.lat,lng:center.lng},address:''});setSelected(null);}}} disabled={!ready}>Drop pin</button>
  </div>
  {mapError&&<p role="status">{mapError}</p>}
  {draft&&<section className="territory-card" aria-label="Place pin"><header><h2>Place pin</h2><button type="button" aria-label="Cancel pin" onClick={()=>{setDraft(null);if(autoFind)changeAutoFind(false);}}>×</button></header><label>House address<input value={draft.address} maxLength={240} onChange={e=>setDraft({...draft,address:e.target.value})}/></label><small>{draft.matched?`Approximate match: ${draft.matched}. Check the pin before saving.`:"Check the address and location before saving."}</small><div className="territory-pin-adjust"><small>Pin misplaced? Move the map to the house, then use the center.</small><button type="button" disabled={!ready} onClick={useMapCenter}>Use map center</button></div>{autoFind&&draft.source==='auto'&&<button type="button" className="territory-skip-address" onClick={()=>setDraft(null)}>Skip this address</button>}<button type="button" disabled={disabled||!draft.address.trim()} onClick={()=>void saveLocation()}>Save location</button>{existingDraft&&<small>Uses the existing address. No duplicate customer.</small>}</section>}
  {current&&<section className="territory-card" aria-label="Selected place"><header><h2>{current.address}</h2><button type="button" aria-label="Close place" onClick={()=>setSelected(null)}>×</button></header>
   {current.customers.map(c=><button type="button" key={c.id} onClick={()=>onOpenCustomer?.(c.id)} disabled={!onOpenCustomer}>{c.name} · Open customer</button>)}
   {!current.customers.length&&onCreateCustomer&&<button type="button" disabled={disabled} onClick={()=>onCreateCustomer(current.address)}>Create customer</button>}
   <p className="territory-status">{pinStatus(current)}</p>
   {current.revisitOn&&<p className="territory-revisit-note" role="status">{current.revisitOn<=today?'Revisit due':'Revisit planned'} · {current.revisitOn}</p>}{current.lastContact&&<small>Last visit {new Date(current.lastContact).toLocaleString()}</small>}{current.note&&<p>{current.note}</p>}
   {current.unverifiedJobs>0&&<small>Job locations need confirmation; completion pins are not assumed.</small>}
   {!current.point&&<button type="button" disabled={searching} onClick={()=>void search(current.address,false,true)}>Locate address</button>}
   {current.houseId&&!suppressed&&<><label>Note<input value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label><div className="territory-actions">{([['contacted','Contacted'],['no-answer','No answer'],['do-not-knock','Do not knock']] as const).map(([status,label])=><button type="button" disabled={disabled} key={status} onClick={()=>void save({action:'visit',houseId:current.houseId,status,note})}>{label}</button>)}<button type="button" aria-expanded={revisitOpen} disabled={disabled} onClick={()=>{setRevisitOpen(!revisitOpen);setRevisitDate(current.revisitOn??'');}}>Plan revisit</button></div>{revisitOpen&&<div className="territory-revisit-editor"><label>Revisit date<input type="date" value={revisitDate} disabled={disabled} onChange={e=>setRevisitDate(e.target.value)}/></label><button type="button" disabled={disabled||!validDoorFollowUpDate(revisitDate)} onClick={()=>void save({action:'visit',houseId:current.houseId,status:'follow-up',followUpOn:revisitDate,note})}>Save revisit</button></div>}</>}
   {suppressed&&<p role="status">Contact blocked.</p>}
   {current.houseId&&<button type="button" onClick={()=>onOpenHouse(current.houseId!)}>Visit history &amp; more</button>}
   <div className="territory-actions"><a href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(current.point?`${current.point.lat},${current.point.lng}`:current.address)} target="_blank" rel="noopener noreferrer">Directions</a>{current.houseId&&current.point&&<button type="button" disabled={disabled||!online} onClick={()=>{if(window.confirm('Remove this map location? The address and all visit history will stay saved.'))void save({action:'unpin',houseId:current.houseId});}}>Remove pin</button>}</div>
  </section>}
  <div className="territory-directory-row"><button type="button" className="territory-fit-pins" disabled={!ready||!visible.some(p=>p.point)} onClick={fitSaved} aria-label="Show all visible pins">Show pins</button><button type="button" className="territory-places-toggle" aria-expanded={showPlaces} onClick={()=>setShowPlaces(!showPlaces)}>Places · {visible.filter(p=>p.point).length} pinned · {visible.filter(p=>!p.point).length} missing</button>{autoFind&&!showPlaces&&<button type="button" className="territory-auto-find" aria-label="Auto-find customer pins" aria-pressed={true} onClick={()=>changeAutoFind(false)}>Stop auto-find</button>}</div>
  {(showPlaces||mapError)&&<><div className="territory-places-tools">{online&&nextUnpinned&&<button type="button" className="territory-locate-next" disabled={searching} aria-label="Locate next unpinned address" onClick={()=>void search(nextUnpinned.address,false,true)}>Locate next</button>}{online&&(nextCustomerPin||autoFind)&&<button type="button" className="territory-auto-find" aria-label="Auto-find customer pins" aria-pressed={autoFind} onClick={()=>changeAutoFind(!autoFind)}>{autoFind?"Stop auto-find":"Auto-find customers"}</button>}{autoFind&&<small className="territory-auto-note">{nextCustomerPin?"One address at a time · review before saving.":"No more addresses this session. Skipped houses remain unpinned."}</small>}</div><label className="territory-place-search"><span className="sr-only">Find saved place or customer</span><input type="search" aria-label="Find saved place or customer" placeholder="Search saved addresses or customers" value={placeQuery} onChange={e=>setPlaceQuery(e.target.value)}/></label><ul className="territory-places">{listedPlaces.slice(0,listLimit).map(p=><li key={p.key} className={[!p.point?'territory-missing-row':'',p.customers.length===1&&onOpenCustomer?'territory-customer-row':''].filter(Boolean).join(' ')||undefined}>
    <button type="button" className="territory-place-open" onClick={()=>focus(p)}>
     <strong>{p.address}</strong>
     {p.customers.length>0&&<small className="territory-place-customer-names">{p.customers.slice(0,2).map(c=>c.name).join(", ")}{p.customers.length>2?` +${p.customers.length-2} more`:""}</small>}
     <small>{unknownOffline&&!p.category?'Status unavailable offline':p.category?TERRITORY_CATEGORIES[p.category].label:'Not visited'}{!p.point?' · Needs location':''}{p.revisitOn?' · Revisit '+p.revisitOn:''}</small>
    </button>
    {p.customers.length===1&&onOpenCustomer&&<button type="button" className="territory-row-customer" aria-label={`Open ${p.customers[0].name} customer profile`} onClick={()=>onOpenCustomer(p.customers[0].id)}>Customer</button>}
    {online&&!p.point&&<button type="button" className="territory-row-locate" aria-label={'Locate '+p.address} disabled={searching} onClick={()=>void search(p.address,false,true)}>Locate</button>}
   </li>)}{!listedPlaces.length&&<li>{placeQuery.trim()?"No matching saved places.":"No places in this filter."}</li>}{listedPlaces.length>listLimit&&<li className="territory-places-more"><button type="button" onClick={()=>setListLimit(n=>n+60)}>Show more · {listedPlaces.length-listLimit} remaining</button></li>}</ul></>}
  <details className="territory-help"><summary>Map help</summary><p>Long-press or use Drop pin. Search sends only the entered address to the US Census geocoder; confirm its approximate location. Street maps: OpenFreeMap / OpenStreetMap. Aerial: USGS The National Map / USDA imagery, which may be older and needs internet. Offline pins are available under Offline pins. Downloadable map imagery is not available yet.</p></details>
 </section>;
}
