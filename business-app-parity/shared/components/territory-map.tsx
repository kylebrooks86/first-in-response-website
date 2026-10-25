'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Map as GLMap,GeoJSONSource,StyleSpecification} from 'maplibre-gl';
import {territoryCardStatus,TERRITORY_CATEGORIES,TERRITORY_VIEW_KEY,TERRITORY_DEFAULT_VIEW,validTerritoryView,territoryPlaces,territoryVisible,territoryGeoJSON,validTerritoryRecords,type TerritoryPlace,type TerritoryRecords} from '../lib/territory';
import {houseKey,doorSuppressed,type DoorBook,type DoorPoint} from '../lib/door-knocking';
const AUTO_FIND_KEY='fire-territory-autofind-customers-v1';
const offlinePinStyle=():StyleSpecification=>({version:8,sources:{},layers:[{id:'offline-pin-background',type:'background',paint:{'background-color':'#e5eceb'}}]});
type Props={online?:boolean;book:DoorBook;disabled:boolean;save:(details:Record<string,unknown>)=>Promise<void>;onOpenCustomer?:(id:string)=>void;onOpenHouse:(id:string)=>void;onCreateCustomer?:(address:string)=>void};
export function TerritoryMap({online=true,book,disabled,save,onOpenCustomer,onOpenHouse,onCreateCustomer}:Props){
 const host=useRef<HTMLDivElement>(null),map=useRef<GLMap|null>(null),alive=useRef(true),recordsRequest=useRef(0),styleOnline=useRef<boolean|null>(null),onlineRef=useRef(online);onlineRef.current=online;
 const [records,setRecords]=useState<TerritoryRecords>({customers:[],jobs:[]}),[recordError,setRecordError]=useState(''),[mapError,setMapError]=useState(''),[ready,setReady]=useState(false),[filter,setFilter]=useState('all'),[selected,setSelected]=useState<string|null>(null),[query,setQuery]=useState(''),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState(''),[draft,setDraft]=useState<{point:DoorPoint;address:string;matched?:string}|null>(null),[note,setNote]=useState(''),[legend,setLegend]=useState(false),[showPlaces,setShowPlaces]=useState(false),[expanded,setExpanded]=useState(false),[autoFind,setAutoFind]=useState(false);
 const autoAttempts=useRef(new Set<string>());
 useEffect(()=>{try{setAutoFind(sessionStorage.getItem(AUTO_FIND_KEY)==='on');}catch{/* No persistent setting in private browsing. */}},[]);
 const changeAutoFind=(next:boolean)=>{autoAttempts.current.clear();setAutoFind(next);try{sessionStorage.setItem(AUTO_FIND_KEY,next?'on':'off');}catch{/* Map still works. */}};
 const places=useMemo(()=>territoryPlaces(book,records),[book,records]),visible=useMemo(()=>territoryVisible(places,filter),[places,filter]),unknownOffline=!online&&!records.customers.length&&!records.jobs.length,geo=useMemo(()=>{const data=territoryGeoJSON(visible);return unknownOffline?{...data,features:data.features.map(f=>({...f,properties:{...f.properties,label:f.properties.color==='#334155'?'Status unavailable offline':f.properties.label}}))}:data;},[visible,unknownOffline]);
 const geoRef=useRef(geo);geoRef.current=geo;
 const pinStatus=(p:TerritoryPlace)=>unknownOffline&&!p.category?'Status unavailable offline':territoryCardStatus(p);
 const current=places.find(p=>p.key===selected)??null;
 const selectRef=useRef((key:string)=>{setSelected(key);setDraft(null);setNote('');});
 const loadRecords=async()=>{const request=++recordsRequest.current;setRecordError('');if(!online){setRecordError('Offline · saved pins only.');return;}try{const r=await fetch('/api/territory',{cache:'no-store'});if(!alive.current||request!==recordsRequest.current)return;if(r.status===401||r.status===403){setRecords({customers:[],jobs:[]});throw Error('Sign in again to view customer pins.');}const v=await r.json() as TerritoryRecords;if(!r.ok||!validTerritoryRecords(v))throw Error('Customer pins unavailable.');if(alive.current&&request===recordsRequest.current)setRecords(v);}catch(e){if(alive.current&&request===recordsRequest.current)setRecordError(e instanceof Error?e.message:'Customer pins unavailable.');}};
 useEffect(()=>{alive.current=true;void loadRecords();return()=>{alive.current=false;recordsRequest.current++;};},[online]);
 useEffect(()=>{
  let canceled=false;let instance:GLMap|null=null;let timer:ReturnType<typeof setTimeout>|undefined;let start:{x:number;y:number}|null=null;let ignoreClickUntil=0;let handlersRegistered=false;
  const clear=()=>{if(timer)clearTimeout(timer);timer=undefined;};
  const cancelMove=(e:PointerEvent)=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)clear();};
  const down=(e:PointerEvent)=>{clear();if(!instance||e.button!==0||(e.target as Element).closest('.maplibregl-ctrl'))return;start={x:e.clientX,y:e.clientY};const rect=host.current!.getBoundingClientRect();const point=instance.unproject([e.clientX-rect.left,e.clientY-rect.top]);timer=setTimeout(()=>{if(!canceled){ignoreClickUntil=Date.now()+1200;setDraft({point:{lat:point.lat,lng:point.lng},address:''});setSelected(null);}},650);};
  void import('maplibre-gl').then(lib=>{
   if(canceled||!host.current)return;
   let initialView=TERRITORY_DEFAULT_VIEW;
   try{const stored=sessionStorage.getItem(TERRITORY_VIEW_KEY);const parsed:unknown=stored?JSON.parse(stored):null;if(validTerritoryView(parsed))initialView=parsed;}catch{/* Private browsing/storage denial: use Tulsa default. */}
   instance=new lib.Map({container:host.current,style:onlineRef.current?'https://tiles.openfreemap.org/styles/liberty':offlinePinStyle(),center:[initialView.lng,initialView.lat],zoom:initialView.zoom,maxZoom:19,attributionControl:{compact:true}});map.current=instance;styleOnline.current=onlineRef.current;
   instance.on('moveend',()=>{if(canceled||!instance)return;const c=instance.getCenter();const view={lat:c.lat,lng:c.lng,zoom:instance.getZoom()};if(validTerritoryView(view))try{sessionStorage.setItem(TERRITORY_VIEW_KEY,JSON.stringify(view));}catch{/* Navigation keeps working without storage. */}});
   instance.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
   instance.addControl(new lib.GeolocateControl({positionOptions:{enableHighAccuracy:true},trackUserLocation:false,showAccuracyCircle:true}),'top-right');
   instance.on('style.load',()=>{if(canceled||!instance)return;instance.addSource('fire-places',{type:'geojson',data:geoRef.current,cluster:true,clusterMaxZoom:16,clusterRadius:45});
    instance.addLayer({id:'fire-clusters',type:'circle',source:'fire-places',filter:['has','point_count'],paint:{'circle-color':'#253950','circle-radius':22,'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}});
    if(instance.getStyle().glyphs)instance.addLayer({id:'fire-counts',type:'symbol',source:'fire-places',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':14},paint:{'text-color':'#ffffff'}});
    instance.addLayer({id:'fire-pins',type:'circle',source:'fire-places',filter:['!',['has','point_count']],paint:{'circle-color':['get','color'],'circle-radius':10,'circle-stroke-width':3,'circle-stroke-color':'#ffffff'}});
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
 useEffect(()=>{const instance=map.current;if(instance&&styleOnline.current!==online){styleOnline.current=online;setReady(false);instance.setStyle(online?'https://tiles.openfreemap.org/styles/liberty':offlinePinStyle());}},[online]);
 useEffect(()=>{const id=requestAnimationFrame(()=>map.current?.resize());return()=>cancelAnimationFrame(id);},[expanded]);
 useEffect(()=>{if(ready)(map.current?.getSource('fire-places') as GeoJSONSource|undefined)?.setData(geo);},[ready,geo]);
 useEffect(()=>{if(ready)(map.current?.getSource('fire-draft') as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features:draft?[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[draft.point.lng,draft.point.lat]}}]:[]});},[ready,draft]);
 useEffect(()=>{setNote('');},[selected]);
 const focus=(p:TerritoryPlace)=>{selectRef.current(p.key);if(p.point)map.current?.easeTo({center:[p.point.lng,p.point.lat],zoom:17});};
 const search=async(address=query,automatic=false)=>{if(searching||!address.trim())return;const known=places.find(p=>p.key===houseKey(address)&&p.point);if(known){focus(known);return;}if(!online){setSearchError('Address lookup needs internet. Use Drop pin.');return;}setSearching(true);setSearchError('');try{const r=await fetch('/api/territory/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address})});const v=await r.json() as {matches?:{address:string;point:DoorPoint}[];error?:string};if(!r.ok)throw Error(v.error||'Lookup unavailable.');const match=v.matches?.[0];if(!match)throw Error('No match. Long-press the map to place it.');if(!alive.current)return;setDraft({point:match.point,address,matched:match.address});setSelected(null);map.current?.easeTo({center:[match.point.lng,match.point.lat],zoom:17});}catch(e){if(alive.current){setSearchError(e instanceof Error?e.message:'Lookup unavailable.');if(automatic)changeAutoFind(false);}}finally{if(alive.current)setSearching(false);}};
 useEffect(()=>{if(!draft)return;const h=book.houses.find(h=>h.addressKey===houseKey(draft.address));if(h?.location?.point&&h.location.point.lat===draft.point.lat&&h.location.point.lng===draft.point.lng){setSelected(h.addressKey);setDraft(null);}},[book,draft]);
 const existingDraft=draft?places.find(p=>p.key===houseKey(draft.address)):null;
 // Unlocated customer and job addresses need an explicit owner-reviewed lookup.
 const nextUnpinned=visible.find(p=>!p.point&&p.address.trim());
 const nextCustomerPin=visible.find(p=>p.customers.length>0&&!p.point&&p.address.trim().length>=5);
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
  <form className="territory-search" onSubmit={e=>{e.preventDefault();void search();}}><input aria-label="Search street address" value={query} maxLength={240} placeholder="Street address, city, state" onChange={e=>setQuery(e.target.value)}/><button disabled={searching||!query.trim()}>Find</button></form>
  <div className="territory-filters" role="group" aria-label="Map filters"><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All</button>{Object.entries(TERRITORY_CATEGORIES).map(([key,c])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{c.filter}</button>)}</div>
  {recordError&&<p role={online?"alert":"status"}>{recordError} {online&&<button type="button" onClick={()=>void loadRecords()}>Retry</button>}</p>}
  {searchError&&<p role="alert">{searchError}</p>}
  <div className={"territory-stage"+(expanded?" territory-expanded":"")}><div ref={host} className="territory-canvas" aria-label="Tulsa street map"/>
   <div className="territory-legend"><button type="button" aria-expanded={legend} onClick={()=>setLegend(!legend)}>Legend</button>{legend&&<ul>{Object.entries(TERRITORY_CATEGORIES).map(([key,c])=><li key={key}><i style={{background:c.color}}/><span>{c.label}</span><b>{visible.filter(p=>p.point&&p.category===key).length}</b></li>)}<li><i style={{background:'#334155'}}/><span>{unknownOffline?'Status unavailable':'Not visited'}</span><b>{visible.filter(p=>p.point&&!p.category).length}</b></li></ul>}</div>
   <span className="territory-crosshair" aria-hidden="true">+</span><button type="button" className="territory-expand" aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?"Done":"Expand"}</button>
   <button type="button" className="territory-overview" onClick={()=>map.current?.fitBounds([[-96.48,35.8],[-95.52,36.55]],{padding:24,maxZoom:11,duration:0})} disabled={!ready} aria-label="Show Tulsa and surrounding towns">Tulsa area</button>
   <button type="button" className="territory-drop" onClick={()=>{const center=map.current?.getCenter();if(center){setDraft({point:{lat:center.lat,lng:center.lng},address:''});setSelected(null);}}} disabled={!ready}>Drop pin</button>
  </div>
  {mapError&&<p role="status">{mapError}</p>}
  {draft&&<section className="territory-card" aria-label="Place pin"><header><h2>Place pin</h2><button type="button" aria-label="Cancel pin" onClick={()=>{setDraft(null);if(autoFind)changeAutoFind(false);}}>×</button></header><label>House address<input value={draft.address} maxLength={240} onChange={e=>setDraft({...draft,address:e.target.value})}/></label><small>{draft.matched?`Approximate match: ${draft.matched}. Check the pin before saving.`:"Check the address and location before saving."}</small><div className="territory-pin-adjust"><small>Pin misplaced? Move the map to the house, then use the center.</small><button type="button" disabled={!ready} onClick={useMapCenter}>Use map center</button></div><button type="button" disabled={disabled||!draft.address.trim()} onClick={()=>void saveLocation()}>Save location</button>{existingDraft&&<small>Uses the existing address. No duplicate customer.</small>}</section>}
  {current&&<section className="territory-card" aria-label="Selected place"><header><h2>{current.address}</h2><button type="button" aria-label="Close place" onClick={()=>setSelected(null)}>×</button></header>
   {current.customers.map(c=><button type="button" key={c.id} onClick={()=>onOpenCustomer?.(c.id)} disabled={!onOpenCustomer}>{c.name} · Open customer</button>)}
   {!current.customers.length&&onCreateCustomer&&<button type="button" disabled={disabled} onClick={()=>onCreateCustomer(current.address)}>Create customer</button>}
   <p className="territory-status">{pinStatus(current)}</p>
   {current.lastContact&&<small>Last visit {new Date(current.lastContact).toLocaleString()}</small>}{current.note&&<p>{current.note}</p>}
   {current.unverifiedJobs>0&&<small>Job locations need confirmation; completion pins are not assumed.</small>}
   {!current.point&&<button type="button" disabled={searching} onClick={()=>void search(current.address)}>Locate address</button>}
   {current.houseId&&!suppressed&&<><label>Note<input value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label><div className="territory-actions">{([['contacted','Contacted'],['no-answer','No answer'],['do-not-knock','Do not knock']] as const).map(([status,label])=><button type="button" disabled={disabled} key={status} onClick={()=>void save({action:'visit',houseId:current.houseId,status,note})}>{label}</button>)}</div></>}
   {suppressed&&<p role="status">Contact blocked.</p>}
   {current.houseId&&<button type="button" onClick={()=>onOpenHouse(current.houseId!)}>Visit history &amp; more</button>}
   <div className="territory-actions"><a href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(current.point?`${current.point.lat},${current.point.lng}`:current.address)} target="_blank" rel="noopener noreferrer">Directions</a>{current.houseId&&current.point&&<button type="button" disabled={disabled||!online} onClick={()=>{if(window.confirm('Remove this map location? The address and all visit history will stay saved.'))void save({action:'unpin',houseId:current.houseId});}}>Remove pin</button>}</div>
  </section>}
  <div className="territory-directory-row"><button type="button" className="territory-places-toggle" aria-expanded={showPlaces} onClick={()=>setShowPlaces(!showPlaces)}>Saved places · {visible.filter(p=>p.point).length} pins · {visible.filter(p=>!p.point).length} missing</button>{online&&nextUnpinned&&<button type="button" className="territory-locate-next" disabled={searching} aria-label="Locate next unpinned address" onClick={()=>void search(nextUnpinned.address)}>Locate next</button>}{online&&nextCustomerPin&&<button type="button" className="territory-auto-find" aria-label="Auto-find customer pins" aria-pressed={autoFind} onClick={()=>changeAutoFind(!autoFind)}>{autoFind?"Stop auto-find":"Auto-find customers"}</button>}{autoFind&&nextCustomerPin&&<small className="territory-auto-note">Sends one customer address to US Census at a time. Review each pin before saving.</small>}</div>
  {(showPlaces||mapError)&&<ul className="territory-places">{visible.map(p=><li key={p.key}><button type="button" onClick={()=>focus(p)}><strong>{p.address}</strong><small>{unknownOffline&&!p.category?'Status unavailable offline':p.category?TERRITORY_CATEGORIES[p.category].label:'Not visited'}{!p.point?' · Needs location':''}</small></button></li>)}{!visible.length&&<li>No places in this filter.</li>}</ul>}
  <details className="territory-help"><summary>Map help</summary><p>Long-press or use Drop pin. Search sends only the entered address to the US Census geocoder; confirm its approximate location. Street maps: OpenFreeMap / OpenStreetMap. Enable offline drafts under Offline pins. Map imagery and satellite downloads are not available offline yet.</p></details>
 </section>;
}
