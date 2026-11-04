import urllib.request,re,pathlib
out=pathlib.Path('public/fonts');out.mkdir(exist_ok=True)
families={'geist-mono':'Geist+Mono:wght@100..900','cormorant':'Cormorant+Garamond:wght@300..700','playfair':'Playfair+Display:wght@400..900','cinzel':'Cinzel:wght@400..900','dm-sans':'DM+Sans:wght@100..1000','josefin':'Josefin+Sans:wght@100..700'}
for name,family in families.items():
 req=urllib.request.Request('https://fonts.googleapis.com/css2?family='+family+'&display=swap',headers={'User-Agent':'Mozilla/5.0'})
 css=urllib.request.urlopen(req,timeout=40).read().decode()
 urls=re.findall(r'url\((https://[^)]+)\)',css)
 if not urls:raise RuntimeError(name+' missing font')
 data=urllib.request.urlopen(urls[-1],timeout=40).read()
 ext='woff2' if data[:4]==b'wOF2' else 'ttf'
 (out/(name+'.'+ext)).write_bytes(data)
 print(name,ext,len(data))
