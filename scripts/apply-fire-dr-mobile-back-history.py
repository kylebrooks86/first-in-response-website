from pathlib import Path

path=Path('app/dashboard.tsx')
if not path.exists():
    raise SystemExit('app/dashboard.tsx not found')
text=path.read_text()

old='''  const previousTab = useRef("dashboard");
  const currentTab = useRef("dashboard");
  useEffect(() => { if (tab !== currentTab.current) { previousTab.current = currentTab.current; currentTab.current = tab; } }, [tab]);
  const goHome = () => { setTab("dashboard"); setMobileMenu(false); };
  const goBack = () => { const target = previousTab.current || "dashboard"; setTab(target); setMobileMenu(false); };'''
new='''  const tabHistory = useRef<string[]>(["dashboard"]);
  const historyBackInProgress = useRef(false);
  useEffect(() => {
    if (historyBackInProgress.current) { historyBackInProgress.current = false; return; }
    const history=tabHistory.current;
    if(history.at(-1)!==tab)history.push(tab);
    if(history.length>20)history.splice(0,history.length-20);
  }, [tab]);
  useEffect(() => {
    // Each top-level workspace opens at its beginning instead of inheriting
    // the previous workspace's document scroll position.
    const resetScroll = () => {
      window.scrollTo({top:0,left:0,behavior:"auto"});
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
    };
    resetScroll();
    const frame=window.requestAnimationFrame(resetScroll);
    return()=>window.cancelAnimationFrame(frame);
  }, [tab]);
  const goHome = () => { setTab("dashboard"); setMobileMenu(false); };
  const goBack = () => {
    const history=tabHistory.current;
    if(history.length>1)history.pop();
    const target=history.at(-1)||"dashboard";
    if(target!==tab){historyBackInProgress.current=true;setTab(target);}
    setMobileMenu(false);
  };'''

if new not in text:
    if old not in text:
        raise SystemExit('DR_MOBILE_BACK_HISTORY_APPLY=FAIL: expected source not found')
    path.write_text(text.replace(old,new,1))

print('DR_MOBILE_BACK_HISTORY_APPLY=PASS')
