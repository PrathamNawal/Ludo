// Three languages in v0.1: Hinglish (default), English, Hindi. More Indian languages are next
// on the roadmap; the structure here is key -> {lang: text}, commentary keys hold arrays.
export const LANGS = { hg: 'Hinglish', en: 'English', hi: 'हिन्दी' };
let lang = 'hg';
export const getLang = () => lang;
// Hinglish is Latin script, so it is tagged 'en' (and the page is marked translate="no" in index.html)
export function setLang(l) { if (LANGS[l]) { lang = l; if (typeof document !== 'undefined') document.documentElement.lang = l === 'hi' ? 'hi' : 'en'; } }

const S = {
  'app.name': { en: 'Ludo Adda', hi: 'लूडो अड्डा', hg: 'Ludo Adda' },
  'app.tag': { en: 'Family Ludo you can trust', hi: 'भरोसे वाला फैमिली लूडो', hg: 'Family Ludo, bharose wala' },
  'home.play': { en: 'Play now', hi: 'अभी खेलें', hg: 'Abhi khelo' },
  'home.play.sub': { en: 'You vs 3 bots · no sign-in', hi: 'आप बनाम 3 बॉट · कोई लॉगिन नहीं', hg: 'Aap vs 3 bots · koi login nahi' },
  'home.resume': { en: 'Resume match', hi: 'मैच जारी रखें', hg: 'Match resume karo' },
  'home.quick': { en: 'Quick Ludo', hi: 'क्विक लूडो', hg: 'Quick Ludo' },
  'home.quick.sub': { en: '2 tokens each · ~5 min', hi: '2-2 गोटी · ~5 मिनट', hg: '2-2 goti · ~5 min' },
  'home.friends': { en: 'Friends on this phone', hi: 'इसी फोन पर दोस्त', hg: 'Is phone pe dost' },
  'home.friends.sub': { en: 'Pass the phone around', hi: 'फोन आगे बढ़ाते जाओ', hg: 'Phone aage badhate jao' },
  'home.family': { en: 'Parivaar Board', hi: 'परिवार बोर्ड', hg: 'Parivaar Board' },
  'home.family.sub': { en: 'Play across cities · send moves on WhatsApp', hi: 'अलग-अलग शहरों से खेलो · चाल WhatsApp पर भेजो', hg: 'Alag shehar se khelo · chaal WhatsApp pe bhejo' },
  'home.daily': { en: 'Roz ki Chaal', hi: 'रोज़ की चाल', hg: 'Roz ki Chaal' },
  'home.daily.sub': { en: 'Today’s puzzle · 2 min · works offline', hi: 'आज की पहेली · 2 मिनट · ऑफलाइन', hg: 'Aaj ki paheli · 2 min · offline' },
  'home.streak': { en: '{n}-day streak', hi: '{n} दिन की स्ट्रीक', hg: '{n} din ki streak' },
  'home.free': { en: 'Free forever · no ads · works offline', hi: 'हमेशा मुफ़्त · कोई विज्ञापन नहीं · ऑफलाइन चलता है', hg: 'Hamesha free · koi ads nahi · offline chalta hai' },
  'home.fair': { en: 'Sachcha Dice: every roll is verifiable', hi: 'सच्चा डाइस: हर रोल जाँचा जा सकता है', hg: 'Sachcha Dice: har roll check kar sakte ho' },
  'home.settings': { en: 'Settings', hi: 'सेटिंग्स', hg: 'Settings' },
  'back': { en: 'Back', hi: 'वापस', hg: 'Wapas' },
  'setup.title': { en: 'Set up match', hi: 'मैच सेट करो', hg: 'Match set karo' },
  'setup.start': { en: 'Start', hi: 'शुरू करो', hg: 'Shuru karo' },
  'setup.tap': { en: 'Tap a colour to change who plays it', hi: 'रंग पर टैप करके बदलो कौन खेलेगा', hg: 'Rang pe tap karke badlo kaun khelega' },
  'setup.mode': { en: 'Tokens each', hi: 'हर किसी की गोटी', hg: 'Har kisi ki goti' },
  'p.off': { en: 'Off', hi: 'बंद', hg: 'Off' },
  'p.human': { en: 'Player', hi: 'खिलाड़ी', hg: 'Player' },
  'p.you': { en: 'You', hi: 'आप', hg: 'Aap' },
  'p.dadi': { en: 'Dadi (careful)', hi: 'दादी (सावधान)', hg: 'Dadi (savdhaan)' },
  'p.bunty': { en: 'Bunty (aggressive)', hi: 'बंटी (तेज़)', hg: 'Bunty (tez)' },
  'p.professor': { en: 'Professor (smart)', hi: 'प्रोफेसर (चालाक)', hg: 'Professor (chalak)' },
  'p.chhotu': { en: 'Chhotu (kid)', hi: 'छोटू (बच्चा)', hg: 'Chhotu (bachcha)' },
  'n.dadi': { en: 'Dadi', hi: 'दादी', hg: 'Dadi' },
  'n.bunty': { en: 'Bunty', hi: 'बंटी', hg: 'Bunty' },
  'n.professor': { en: 'Professor', hi: 'प्रोफेसर', hg: 'Professor' },
  'n.chhotu': { en: 'Chhotu', hi: 'छोटू', hg: 'Chhotu' },
  'n.player': { en: 'Player {n}', hi: 'खिलाड़ी {n}', hg: 'Player {n}' },
  'game.tapRoll': { en: 'Tap the dice', hi: 'डाइस पर टैप करो', hg: 'Dice pe tap karo' },
  'game.pick': { en: 'Tap a glowing token', hi: 'चमकती गोटी चुनो', hg: 'Chamakti goti chuno' },
  'game.turn': { en: '{name}’s turn', hi: '{name} की बारी', hg: '{name} ki baari' },
  'game.dice': { en: 'Dice', hi: 'डाइस', hg: 'Dice' },
  'game.locked': { en: 'Dice locked', hi: 'डाइस लॉक', hg: 'Dice lock' },
  'game.lockedTip': { en: 'This code was fixed before the first roll. After the match you can verify every roll.', hi: 'यह कोड पहले रोल से पहले तय हो गया था। मैच के बाद हर रोल जाँच सकते हो।', hg: 'Ye code pehle roll se pehle fix ho gaya tha. Match ke baad har roll check kar sakte ho.' },
  'res.win': { en: '{name} wins!', hi: '{name} जीत गए!', hg: '{name} jeet gaye!' },
  'res.youwin': { en: 'You win! 🎉', hi: 'आप जीत गए! 🎉', hg: 'Aap jeet gaye! 🎉' },
  'res.again': { en: 'Play again', hi: 'फिर खेलें', hg: 'Phir khelo' },
  'res.home': { en: 'Home', hi: 'होम', hg: 'Home' },
  'res.stats': { en: 'Dice stats', hi: 'डाइस आँकड़े', hg: 'Dice stats' },
  'res.statsNote': { en: 'Each bar is how often a face came up. The line is what fair dice would give.', hi: 'हर बार बताता है कि कितनी बार वो अंक आया। लाइन उचित डाइस का औसत है।', hg: 'Har bar batata hai kitni baar wo ank aaya. Line fair dice ka average hai.' },
  'res.verify': { en: 'Verify my dice', hi: 'मेरा डाइस जाँचो', hg: 'Mera dice verify karo' },
  'res.verifying': { en: 'Checking {n} rolls…', hi: '{n} रोल जाँच रहे हैं…', hg: '{n} roll check ho rahe hain…' },
  'res.verified': { en: '✅ All {n} rolls match the code locked before the match.', hi: '✅ सभी {n} रोल मैच से पहले लॉक हुए कोड से मेल खाते हैं।', hg: '✅ Saare {n} roll match se pehle lock hue code se match karte hain.' },
  'res.failed': { en: '⚠️ Mismatch found. These rolls do not match the locked code.', hi: '⚠️ गड़बड़ मिली। ये रोल लॉक कोड से मेल नहीं खाते।', hg: '⚠️ Gadbad mili. Ye roll lock code se match nahi karte.' },
  'res.seed': { en: 'Secret seed', hi: 'सीक्रेट सीड', hg: 'Secret seed' },
  'res.commit': { en: 'Locked code', hi: 'लॉक कोड', hg: 'Lock code' },
  'res.sixes': { en: 'sixes', hi: 'छक्के', hg: 'sixes' },
  'res.rolls': { en: 'rolls', hi: 'रोल', hg: 'rolls' },
  'res.homeTokens': { en: '{n} home', hi: '{n} घर पहुँचे', hg: '{n} ghar pahunche' },
  'confirm.leave': { en: 'Your match is saved. Resume it any time.', hi: 'आपका मैच सेव है। कभी भी जारी रखो।', hg: 'Aapka match save hai. Kabhi bhi resume karo.' },
  'settings.lang': { en: 'Language', hi: 'भाषा', hg: 'Bhasha' },
  'settings.sound': { en: 'Sound', hi: 'आवाज़', hg: 'Awaaz' },
  'settings.voice': { en: 'Voice commentary', hi: 'आवाज़ में कमेंट्री', hg: 'Awaaz mein commentary' },
  'voice.hindi': { en: 'Hindi voice', hi: 'हिन्दी आवाज़', hg: 'Hindi awaaz' },
  'voice.english': { en: 'English voice', hi: 'अंग्रेज़ी आवाज़', hg: 'English awaaz' },
  'voice.auto': { en: 'Auto (best)', hi: 'अपने आप (सबसे अच्छी)', hg: 'Auto (sabse achhi)' },
  'voice.sample': { en: 'Welcome to the Adda! Let the game begin.', hi: 'अड्डे में स्वागत है! खेल शुरू करते हैं।', hg: 'Adda mein swagat hai! Khel shuru karte hain.' },
  'voice.none': { en: 'No voice found on this phone. Install text-to-speech in your phone settings.', hi: 'इस फोन में आवाज़ नहीं मिली। फोन सेटिंग्स में टेक्स्ट-टू-स्पीच इंस्टॉल करो।', hg: 'Is phone mein awaaz nahi mili. Phone settings mein text-to-speech install karo.' },
  'settings.haptics': { en: 'Vibration', hi: 'वाइब्रेशन', hg: 'Vibration' },
  'settings.motion': { en: 'Reduce motion', hi: 'कम एनिमेशन', hg: 'Kam animation' },
  'settings.on': { en: 'On', hi: 'चालू', hg: 'On' },
  'settings.off': { en: 'Off', hi: 'बंद', hg: 'Off' },
  'settings.gfx': { en: 'Graphics', hi: 'ग्राफ़िक्स', hg: 'Graphics' },
  'gfx.3d': { en: '3D', hi: '3D', hg: '3D' },
  'gfx.lite': { en: 'Lite', hi: 'लाइट', hg: 'Lite' },
  'settings.gfxTip': { en: 'Lite is faster on older phones.', hi: 'पुराने फोन पर लाइट तेज़ चलता है।', hg: 'Purane phone pe Lite tez chalta hai.' },
  'game.dragTip': { en: 'Drag to look around', hi: 'घुमाकर देखो', hg: 'Ghumake dekho' },
  'settings.install': { en: 'Install app', hi: 'ऐप इंस्टॉल करो', hg: 'App install karo' },
  'settings.about': { en: 'Free forever. No ads. No sign-in. Plays offline.', hi: 'हमेशा मुफ़्त। कोई विज्ञापन नहीं। कोई लॉगिन नहीं। ऑफलाइन चलता है।', hg: 'Hamesha free. Koi ads nahi. Koi login nahi. Offline chalta hai.' },
  'daily.title': { en: 'Roz ki Chaal #{n}', hi: 'रोज़ की चाल #{n}', hg: 'Roz ki Chaal #{n}' },
  'daily.easy': { en: 'Easy', hi: 'आसान', hg: 'Easy' },
  'daily.medium': { en: 'Medium', hi: 'मध्यम', hg: 'Medium' },
  'daily.hard': { en: 'Hard', hi: 'कठिन', hg: 'Hard' },
  'goal.capture': { en: 'Capture a rival token', hi: 'किसी विरोधी की गोटी काटो', hg: 'Kisi rival ki goti kaato' },
  'goal.capture2': { en: 'Capture 2 rival tokens', hi: '2 विरोधी गोटियाँ काटो', hg: '2 rival goti kaato' },
  'goal.home': { en: 'Bring a token home', hi: 'एक गोटी घर पहुँचाओ', hg: 'Ek goti ghar pahunchao' },
  'daily.rolls': { en: 'Your rolls, in order', hi: 'आपके रोल, क्रम में', hg: 'Aapke roll, order mein' },
  'daily.pick': { en: 'Pick a red token to play roll {n}', hi: 'रोल {n} के लिए लाल गोटी चुनो', hg: 'Roll {n} ke liye laal goti chuno' },
  'daily.skip': { en: 'No legal move: roll skipped', hi: 'कोई चाल नहीं: रोल छूट गया', hg: 'Koi chaal nahi: roll skip' },
  'daily.undo': { en: 'Undo', hi: 'वापस', hg: 'Undo' },
  'daily.reset': { en: 'Restart', hi: 'दोबारा', hg: 'Dobara' },
  'daily.hint': { en: 'Hint ({n})', hi: 'हिंट ({n})', hg: 'Hint ({n})' },
  'daily.noHint': { en: 'No hints left today', hi: 'आज हिंट खत्म', hg: 'Aaj ke hints khatam' },
  'daily.hintTip': { en: '3 free hints a day', hi: 'रोज़ 3 हिंट मुफ़्त', hg: 'Roz 3 hint free' },
  'daily.solved': { en: 'Solved! 🎉', hi: 'हल हो गया! 🎉', hg: 'Solve ho gaya! 🎉' },
  'daily.failed': { en: 'Not quite. Try again!', hi: 'लगभग! फिर कोशिश करो!', hg: 'Lagbhag! Phir try karo!' },
  'daily.share': { en: 'Share result', hi: 'नतीजा शेयर करो', hg: 'Result share karo' },
  'daily.copied': { en: 'Copied! Paste it in WhatsApp', hi: 'कॉपी हुआ! WhatsApp में पेस्ट करो', hg: 'Copy hua! WhatsApp mein paste karo' },
  'daily.older': { en: 'Older puzzles', hi: 'पुरानी पहेलियाँ', hg: 'Purani paheliyan' },
  'daily.tries': { en: '{n} tries', hi: '{n} कोशिश', hg: '{n} try' },
  'daily.next': { en: 'Next puzzle', hi: 'अगली पहेली', hg: 'Agli paheli' },
  'fam.title': { en: 'Parivaar Board', hi: 'परिवार बोर्ड', hg: 'Parivaar Board' },
  'fam.intro': { en: 'Everyone plays when they are free. After your move, send the link on WhatsApp.', hi: 'सब अपने समय पर खेलो। चाल चलकर लिंक WhatsApp पर भेजो।', hg: 'Sab apne time pe khelo. Chaal chalke link WhatsApp pe bhejo.' },
  'fam.names': { en: 'Who is playing?', hi: 'कौन खेल रहा है?', hg: 'Kaun khel raha hai?' },
  'fam.create': { en: 'Create board', hi: 'बोर्ड बनाओ', hg: 'Board banao' },
  'fam.who': { en: 'Who are you?', hi: 'आप कौन हो?', hg: 'Aap kaun ho?' },
  'fam.yourTurn': { en: 'Your turn!', hi: 'आपकी बारी!', hg: 'Aapki baari!' },
  'fam.waiting': { en: 'Waiting for {name}', hi: '{name} का इंतज़ार', hg: '{name} ka intezaar' },
  'fam.send': { en: 'Send to {name} on WhatsApp', hi: '{name} को WhatsApp पर भेजो', hg: '{name} ko WhatsApp pe bhejo' },
  'fam.copy': { en: 'Copy link', hi: 'लिंक कॉपी करो', hg: 'Link copy karo' },
  'fam.copied': { en: 'Link copied', hi: 'लिंक कॉपी हुआ', hg: 'Link copy hua' },
  'fam.msg': { en: 'Your turn in our Ludo game! Tap to play:', hi: 'हमारे लूडो में आपकी बारी! खेलने के लिए टैप करो:', hg: 'Hamare Ludo mein aapki baari! Khelne ke liye tap karo:' },
  'fam.badLink': { en: 'This link is broken. Ask for a fresh one.', hi: 'यह लिंक खराब है। नया माँगो।', hg: 'Ye link kharab hai. Naya maango.' },
  'fam.note': { en: 'No server needed: the match lives in the link.', hi: 'सर्वर की ज़रूरत नहीं: मैच लिंक में ही है।', hg: 'Server ki zaroorat nahi: match link mein hi hai.' },
  'fam.verifyNote': { en: 'Dice check: each player’s dice code was locked in the link. Reveal seeds at the end to verify.', hi: 'डाइस जाँच: हर खिलाड़ी का डाइस कोड लिंक में लॉक है। अंत में सीड खोलकर जाँचो।', hg: 'Dice check: har player ka dice code link mein lock hai. End mein seed kholke check karo.' },
  'fam.reveal': { en: 'Reveal my dice seed', hi: 'मेरा डाइस सीड खोलो', hg: 'Mera dice seed kholo' },
  'fam.seatOk': { en: '{name}: ✅ {n} rolls verified', hi: '{name}: ✅ {n} रोल सही', hg: '{name}: ✅ {n} roll sahi' },
  'fam.seatPending': { en: '{name}: seed not revealed yet', hi: '{name}: सीड अभी नहीं खुला', hg: '{name}: seed abhi nahi khula' },
  'fam.seatBad': { en: '{name}: ⚠️ mismatch', hi: '{name}: ⚠️ गड़बड़', hg: '{name}: ⚠️ gadbad' },
  'app.updated': { en: 'New version ready. It loads when you go home.', hi: 'नया वर्ज़न तैयार है। होम पर जाते ही लोड होगा।', hg: 'Naya version ready hai. Home pe jaate hi load hoga.' },
  'ok': { en: 'OK', hi: 'ठीक है', hg: 'OK' },
  'offline.ready': { en: 'Ready to play offline', hi: 'ऑफलाइन खेलने को तैयार', hg: 'Offline khelne ke liye ready' },
};

// Commentary: cricket-commentator style. Each key holds variants per language.
const C = {
  start: {
    en: ['Toss done, dice locked. Let the game begin!', 'Welcome to the Adda! First roll coming up.'],
    hi: ['टॉस हो गया, डाइस लॉक है। खेल शुरू!', 'अड्डे में स्वागत है! पहला रोल आने वाला है।'],
    hg: ['Toss ho gaya, dice lock hai. Khel shuru!', 'Adda mein swagat hai! Pehla roll aane wala hai.'],
  },
  roll: {
    en: ['{name} rolls a {n}.', '{name} throws {n}.'],
    hi: ['{name} ने {n} फेंका।', '{name} का रोल: {n}।'],
    hg: ['{name} ne {n} phenka.', '{name} ka roll: {n}.'],
  },
  six: {
    en: ['SIX! {name} gets another go!', 'Chhakka! {name} is on fire!'],
    hi: ['छक्का! {name} को एक और मौका!', 'चौका नहीं, छक्का! {name} फॉर्म में हैं!'],
    hg: ['Chhakka! {name} ko ek aur mauka!', 'Chhakka! {name} form mein hain!'],
  },
  leave: {
    en: ['{name} brings a token out. Game on!', 'Out of the base! {name} is racing.'],
    hi: ['{name} की गोटी बाहर आई। खेल चालू!', 'बेस से बाहर! {name} दौड़ में।'],
    hg: ['{name} ki goti bahar aayi. Khel chalu!', 'Base se bahar! {name} race mein.'],
  },
  capture: {
    en: ['Arre! {name} sends {victim} back home!', 'Gone! {victim} is back at the start!', 'What a hit by {name}!'],
    hi: ['अरे! {name} ने {victim} को घर भेज दिया!', 'गई! {victim} की गोटी वापस बेस में!', 'क्या शॉट मारा {name} ने!'],
    hg: ['Arre! {name} ne {victim} ko ghar bhej diya!', 'Gayi! {victim} ki goti wapas base mein!', 'Kya shot maara {name} ne!'],
  },
  home: {
    en: ['A token reaches home! Shabash, {name}!', 'Home sweet home for {name}!'],
    hi: ['एक गोटी घर पहुँची! शाबाश, {name}!', '{name} की गोटी मंज़िल पर!'],
    hg: ['Ek goti ghar pahunchi! Shabash, {name}!', '{name} ki goti manzil pe!'],
  },
  safe: {
    en: ['Safe on the star. Smart.', 'Parked on a safe square.'],
    hi: ['स्टार पर सुरक्षित। समझदारी!', 'सुरक्षित घर पर खड़ी।'],
    hg: ['Star pe safe. Samajhdaari!', 'Safe ghar pe khadi.'],
  },
  pass: {
    en: ['No move for {name}. Pass.', '{name} is stuck this time.'],
    hi: ['{name} के पास चाल नहीं। पास।', 'इस बार {name} अटक गए।'],
    hg: ['{name} ke paas chaal nahi. Pass.', 'Is baar {name} atak gaye.'],
  },
  forfeit: {
    en: ['Three sixes in a row! {name} loses the turn.', 'Too greedy! Third six cancels the turn.'],
    hi: ['लगातार तीन छक्के! {name} की बारी गई।', 'लालच बुरी बला! तीसरा छक्का बारी रद्द।'],
    hg: ['Lagaataar teen chhakke! {name} ki baari gayi.', 'Laalach buri bala! Teesra chhakka baari cancel.'],
  },
  win: {
    en: ['{name} wins the Adda! Baraat time!', 'Champion: {name}!'],
    hi: ['{name} ने अड्डा जीत लिया! बारात निकालो!', 'चैंपियन: {name}!'],
    hg: ['{name} ne Adda jeet liya! Baraat nikalo!', 'Champion: {name}!'],
  },
};

const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v && v[k] !== undefined ? v[k] : ''));
/** Translate into a specific language (used to get Devanagari names for speech). */
export const tIn = (l, key, vars) => fmt((S[key] && (S[key][l] || S[key].en)) || key, vars);
export const t = (key, vars) => fmt((S[key] && (S[key][lang] || S[key].en)) || key, vars);
export function say(event, vars) {
  const set = C[event];
  const arr = (set && (set[lang] || set.en)) || [''];
  return fmt(arr[Math.floor(Math.random() * arr.length)], vars);
}
/**
 * One commentary line as {text, speech}. `text` is what is shown. `speech` is what is spoken: for
 * Hinglish and Hindi it is the Devanagari variant of the SAME line (same index), so a Hindi voice reads
 * it properly instead of an English voice mangling Romanised Hindi. `sv` holds the Devanagari values
 * for the placeholders; if any is missing (e.g. a family member's custom name) we fall back to `text`.
 */
export function sayParts(event, vars, sv) {
  const set = C[event];
  const arr = (set && (set[lang] || set.en)) || [''];
  const i = Math.floor(Math.random() * arr.length);
  const text = fmt(arr[i], vars);
  let speech = text;
  if (lang !== 'en' && set && set.hi && set.hi[i]) {
    const need = (set.hi[i].match(/\{(\w+)\}/g) || []).map(x => x.slice(1, -1));
    if (need.every(k => sv && sv[k] !== undefined && sv[k] !== null)) speech = fmt(set.hi[i], sv);
  }
  return { text, speech };
}
export const _tables = { S, C };
