import { useState, useEffect, useCallback, useMemo } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { db } from "./firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from "firebase/firestore";

// ============================================================
// 性格診断フォーム作成システム（完全版）
// 管理者ログイン・回答者情報収集・回答記録・結果表示制御
// 3種フォーム: 標準性格診断 / キッズブランド / 人事採用
// ============================================================

// --- ユーティリティ ---
const uid = () => Math.random().toString(36).slice(2, 10);

// ============================================================
// 初期データ定義
// ============================================================

// --- タイプA: 標準性格診断（既存4タイプ） ---
const TYPES_STANDARD = [
  {
    id: "type_a", name: "コミュニケーション重視タイプ", color: "#E8845C", icon: "💬",
    userDescription: "人との関わりの中で力を発揮するタイプです。\n会話や共有を通じて状況を理解し、安心感や前向きな気持ちを作るのが得意です。\n一人で考えるよりも、誰かと話しながら進めることで本来の良さが出やすい傾向があります。\n周囲との関係性を大切にし、場の雰囲気を良くする存在です。",
    adminDescription: "情報処理：対話ベース\n強み：調整力、場づくり、関係構築\n注意点：一人での意思決定はやや苦手な場合あり\n向いている役割例：チームのハブ、顧客接点、社内外の調整役",
  },
  {
    id: "type_b", name: "分析型タイプ", color: "#5B8DB8", icon: "🔍",
    userDescription: "物事を整理して考えるのが得意なタイプです。\n情報を集めて比較し、自分なりに納得してから動くことを大切にします。\n勢いよりも理解を重視し、落ち着いた判断ができるのが強み。\n考える時間を取ることで、本領を発揮します。",
    adminDescription: "情報処理：論理・比較・構造化\n強み：精度、再現性、リスク察知\n注意点：判断に時間がかかることあり\n向いている役割例：設計・企画、数値管理、仕組みづくり",
  },
  {
    id: "type_c", name: "決断型タイプ", color: "#D4594E", icon: "⚡",
    userDescription: "行動を通じて前に進むタイプです。\n考えすぎるより、まず動いて状況をつかむことを得意とします。\nスピード感があり、変化にも柔軟。\n決める場面では迷いが少なく、周囲を引っ張る力があります。",
    adminDescription: "情報処理：直感＋即行動\n強み：スピード、推進力、変化対応\n注意点：検討不足になる可能性\n向いている役割例：新規立ち上げ、意思決定ポジション、前線・実行役",
  },
  {
    id: "type_d", name: "安定志向タイプ", color: "#6BA368", icon: "🌿",
    userDescription: "落ち着いた環境で力を発揮するタイプです。\n慣れた流れや安心できる状況の中で、安定した判断ができます。\n急な変化よりも、継続性や確実性を重視。\n周囲に安心感を与える存在です。",
    adminDescription: "情報処理：経験・継続性重視\n強み：安定運用、信頼性、持続力\n注意点：急な変化には慎重\n向いている役割例：運用・管理、定常業務、長期プロジェクト支援",
  },
];

// --- タイプB: キッズブランド顧客ペルソナ ---
const TYPES_KIDS = [
  {
    id: "type_kids_a", name: "アクティブファミリー型", color: "#FF7043", icon: "🏃",
    userDescription: "活動的で体験を重視するご家庭です。\nお子さまと一緒に体を動かしたり、自然の中で過ごす時間を大切にされています。\nイベントや体験型サービスとの親和性が高く、新しい経験に前向きです。",
    adminDescription: "体験・アクティビティ訴求が有効。週末・季節イベント向けプロモーション推奨。\nアウトドア系コラボ・体験イベント集客に強い。リピート率が高い傾向。",
  },
  {
    id: "type_kids_b", name: "教育重視型", color: "#5C6BC0", icon: "📚",
    userDescription: "子どもの学びと成長に力を注ぐご家庭です。\n教育的価値のある商品・サービスを好み、長期的な視点でお子さまの発達を支えています。\n質の高いコンテンツを見極める目をお持ちです。",
    adminDescription: "知育・能力開発訴求が有効。長期的な関係構築・定期購入モデルに向く。\n教育コンテンツとの連携・ワークショップ型イベントが刺さりやすい。",
  },
  {
    id: "type_kids_c", name: "トレンド感度型", color: "#EC407A", icon: "✨",
    userDescription: "デザインやトレンドに敏感なご家庭です。\nSNSで情報収集し、話題の商品やブランドに関心が高く、ビジュアルの魅力を重視されています。\nお子さまのファッションやライフスタイルにもこだわりを持っています。",
    adminDescription: "ビジュアル・ストーリー訴求が有効。インフルエンサー施策・SNS連動キャンペーン推奨。\nInstagram / TikTok経由のリーチが高い。限定感・話題性のある施策が有効。",
  },
  {
    id: "type_kids_d", name: "コミュニティ型", color: "#26A69A", icon: "🤝",
    userDescription: "同じ価値観を持つ仲間とのつながりを大切にするご家庭です。\n口コミと信頼が購買の決め手になり、コミュニティ内での評判を重視されています。\n信頼できる情報源からの推薦に強く反応します。",
    adminDescription: "紹介・コミュニティ施策が有効。ママ友ネットワーク・グループ向けイベント推奨。\n紹介キャンペーン・口コミ促進施策のROIが高い。LTV長期化傾向。",
  },
];

// --- タイプC: 人事採用適性 ---
const TYPES_HR = [
  {
    id: "type_hr_a", name: "即戦力型", color: "#E53935", icon: "🚀",
    userDescription: "培ってきたスキルと経験を即座に活かせるタイプです。\n入社当初から成果を出す力があり、実践的なアプローチを得意とします。\n具体的な目標に向かって効率的に動くことができます。",
    adminDescription: "短期間での戦力化が見込める。配属先の即戦力として期待できるが、変化への柔軟性は要確認。\n経験者採用・中途採用ポジションとの相性が高い。",
  },
  {
    id: "type_hr_b", name: "成長志向型", color: "#43A047", icon: "🌱",
    userDescription: "学び続けることを原動力とするタイプです。\n新しい環境・課題に対して前向きに取り組み、成長を楽しむことができます。\nフィードバックを活かし、継続的にスキルアップしていきます。",
    adminDescription: "中長期での成長が期待できる。育成投資効果が高く、ポテンシャル採用に向く。\n新卒・第二新卒ポジションとの相性が高い。メンター制度との相乗効果あり。",
  },
  {
    id: "type_hr_c", name: "安定貢献型", color: "#1E88E5", icon: "🏛️",
    userDescription: "チームや組織の安定を支えるタイプです。\n継続的に信頼されるパフォーマンスを発揮し、周囲と協力しながら着実に成果を積み上げます。\n組織の土台を支える存在として重要な役割を果たします。",
    adminDescription: "定常業務・チームの安定運用に貢献。長期定着が見込める。変化対応力は環境次第。\nバックオフィス・サポート系ポジションとの相性が高い。離職リスク低め。",
  },
  {
    id: "type_hr_d", name: "専門特化型", color: "#8E24AA", icon: "🔬",
    userDescription: "特定分野への深い専門性を武器とするタイプです。\nその分野では圧倒的な力を発揮し、専門知識を深め続けることに情熱を持っています。\n技術的な課題解決において高い価値を提供します。",
    adminDescription: "専門職・技術職ポジションに最適。横断的な役割よりも専門領域での活躍が向く。\nR&D・エンジニアリング・専門コンサルポジションとの相性が高い。",
  },
];

// --- 質問: 標準性格診断（既存10問） ---
const QUESTIONS_STANDARD = [
  { id: "q1", text: "休日、急に予定が空いたら？", choices: [
    { id: "q1a", label: "誰かに連絡して会う", typeId: "type_a", score: 1 },
    { id: "q1b", label: "何をするか少し考えてから決める", typeId: "type_b", score: 1 },
    { id: "q1c", label: "とりあえず外に出る", typeId: "type_c", score: 1 },
    { id: "q1d", label: "家でいつもの過ごし方をする", typeId: "type_d", score: 1 },
  ]},
  { id: "q2", text: "新しいお店やサービスを知ったとき", choices: [
    { id: "q2a", label: "誰かのおすすめを聞いてみる", typeId: "type_a", score: 1 },
    { id: "q2b", label: "口コミや評価をチェックする", typeId: "type_b", score: 1 },
    { id: "q2c", label: "直感で良さそうならすぐ試す", typeId: "type_c", score: 1 },
    { id: "q2d", label: "しばらく様子を見る", typeId: "type_d", score: 1 },
  ]},
  { id: "q3", text: "旅行やお出かけの計画は？", choices: [
    { id: "q3a", label: "誰と行くかを一番大事にする", typeId: "type_a", score: 1 },
    { id: "q3b", label: "事前にルートや時間を調べる", typeId: "type_b", score: 1 },
    { id: "q3c", label: "大枠だけ決めてあとは現地で", typeId: "type_c", score: 1 },
    { id: "q3d", label: "行き慣れた場所を選ぶ", typeId: "type_d", score: 1 },
  ]},
  { id: "q4", text: "初めての場所に行くとき", choices: [
    { id: "q4a", label: "周りの人の動きを見て行動する", typeId: "type_a", score: 1 },
    { id: "q4b", label: "地図や案内を事前に確認する", typeId: "type_b", score: 1 },
    { id: "q4c", label: "迷ったらその場で判断する", typeId: "type_c", score: 1 },
    { id: "q4d", label: "分かりやすいルートを選ぶ", typeId: "type_d", score: 1 },
  ]},
  { id: "q5", text: "待ち時間ができたら？", choices: [
    { id: "q5a", label: "人と話す・連絡を取る", typeId: "type_a", score: 1 },
    { id: "q5b", label: "情報を調べたり考え事をする", typeId: "type_b", score: 1 },
    { id: "q5c", label: "別の用事をすぐ始める", typeId: "type_c", score: 1 },
    { id: "q5d", label: "落ち着いて待つ", typeId: "type_d", score: 1 },
  ]},
  { id: "q6", text: "買い物をするときの決め方", choices: [
    { id: "q6a", label: "誰かと相談しながら決める", typeId: "type_a", score: 1 },
    { id: "q6b", label: "比較して納得してから買う", typeId: "type_b", score: 1 },
    { id: "q6c", label: "良さそうなら即決", typeId: "type_c", score: 1 },
    { id: "q6d", label: "いつもと同じものを選ぶ", typeId: "type_d", score: 1 },
  ]},
  { id: "q7", text: "新しい趣味に興味を持ったら？", choices: [
    { id: "q7a", label: "一緒にやる人を探す", typeId: "type_a", score: 1 },
    { id: "q7b", label: "まず調べて向いてるか考える", typeId: "type_b", score: 1 },
    { id: "q7c", label: "とりあえずやってみる", typeId: "type_c", score: 1 },
    { id: "q7d", label: "しばらく考えてから判断する", typeId: "type_d", score: 1 },
  ]},
  { id: "q8", text: "予定が変更になったとき", choices: [
    { id: "q8a", label: "周囲と話して調整する", typeId: "type_a", score: 1 },
    { id: "q8b", label: "状況を整理して考える", typeId: "type_b", score: 1 },
    { id: "q8c", label: "その場で切り替える", typeId: "type_c", score: 1 },
    { id: "q8d", label: "できるだけ元の予定を保つ", typeId: "type_d", score: 1 },
  ]},
  { id: "q9", text: "知らないことに出会ったら", choices: [
    { id: "q9a", label: "人に聞く", typeId: "type_a", score: 1 },
    { id: "q9b", label: "自分で調べる", typeId: "type_b", score: 1 },
    { id: "q9c", label: "試しながら理解する", typeId: "type_c", score: 1 },
    { id: "q9d", label: "必要になるまで保留する", typeId: "type_d", score: 1 },
  ]},
  { id: "q10", text: "一日の終わりに満足感を感じるのは？", choices: [
    { id: "q10a", label: "人と話せた日", typeId: "type_a", score: 1 },
    { id: "q10b", label: "理解が深まった日", typeId: "type_b", score: 1 },
    { id: "q10c", label: "行動できた日", typeId: "type_c", score: 1 },
    { id: "q10d", label: "落ち着いて過ごせた日", typeId: "type_d", score: 1 },
  ]},
];

// --- 質問: キッズブランド顧客ペルソナ（6問） ---
const QUESTIONS_KIDS = [
  { id: "q_kids_1", text: "週末の過ごし方として最も近いのは？", choices: [
    { id: "q_kids_1a", label: "公園や自然の中でアクティブに過ごす", typeId: "type_kids_a", score: 1 },
    { id: "q_kids_1b", label: "知育教室や習い事・体験学習に参加する", typeId: "type_kids_b", score: 1 },
    { id: "q_kids_1c", label: "おしゃれなカフェや話題スポットに出かける", typeId: "type_kids_c", score: 1 },
    { id: "q_kids_1d", label: "仲の良いファミリーと集まって過ごす", typeId: "type_kids_d", score: 1 },
  ]},
  { id: "q_kids_2", text: "子ども向け商品を選ぶとき、一番重視することは？", choices: [
    { id: "q_kids_2a", label: "外遊びや体を動かすことに使えるか", typeId: "type_kids_a", score: 1 },
    { id: "q_kids_2b", label: "知育・学習・創造性を育てられるか", typeId: "type_kids_b", score: 1 },
    { id: "q_kids_2c", label: "デザインがかわいい・人気があるか", typeId: "type_kids_c", score: 1 },
    { id: "q_kids_2d", label: "周りの友達も使っていて評判が良いか", typeId: "type_kids_d", score: 1 },
  ]},
  { id: "q_kids_3", text: "子どもの習い事を選ぶ基準は？", choices: [
    { id: "q_kids_3a", label: "体力づくりや運動能力が伸びること", typeId: "type_kids_a", score: 1 },
    { id: "q_kids_3b", label: "学力や思考力が身につくこと", typeId: "type_kids_b", score: 1 },
    { id: "q_kids_3c", label: "今話題の習い事・SNSで見かけたもの", typeId: "type_kids_c", score: 1 },
    { id: "q_kids_3d", label: "お友達が通っている・口コミが良いこと", typeId: "type_kids_d", score: 1 },
  ]},
  { id: "q_kids_4", text: "子どものお誕生日会をするなら？", choices: [
    { id: "q_kids_4a", label: "アスレチックや公園でアクティブに", typeId: "type_kids_a", score: 1 },
    { id: "q_kids_4b", label: "科学実験やワークショップ体験", typeId: "type_kids_b", score: 1 },
    { id: "q_kids_4c", label: "映えるデコレーションやテーマパーティ", typeId: "type_kids_c", score: 1 },
    { id: "q_kids_4d", label: "いつものお友達グループで集まるパーティ", typeId: "type_kids_d", score: 1 },
  ]},
  { id: "q_kids_5", text: "新しいキッズブランドを知るきっかけは？", choices: [
    { id: "q_kids_5a", label: "アウトドアイベントや体験会で知った", typeId: "type_kids_a", score: 1 },
    { id: "q_kids_5b", label: "教育系メディアや専門家の推薦", typeId: "type_kids_b", score: 1 },
    { id: "q_kids_5c", label: "InstagramやTikTokで見かけた", typeId: "type_kids_c", score: 1 },
    { id: "q_kids_5d", label: "ママ友やパパ友からの口コミ", typeId: "type_kids_d", score: 1 },
  ]},
  { id: "q_kids_6", text: "家族で大切にしている価値観は？", choices: [
    { id: "q_kids_6a", label: "健康的でアクティブな生活", typeId: "type_kids_a", score: 1 },
    { id: "q_kids_6b", label: "学びと知的好奇心を育むこと", typeId: "type_kids_b", score: 1 },
    { id: "q_kids_6c", label: "おしゃれで洗練されたライフスタイル", typeId: "type_kids_c", score: 1 },
    { id: "q_kids_6d", label: "信頼できる人間関係とコミュニティ", typeId: "type_kids_d", score: 1 },
  ]},
];

// --- 質問: 人事採用適性診断（10問） ---
const QUESTIONS_HR = [
  { id: "q_hr_1", text: "仕事でやりがいを感じる場面は？", choices: [
    { id: "q_hr_1a", label: "即座に結果を出せたとき", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_1b", label: "新しいことを学び成長を感じたとき", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_1c", label: "チームに貢献し感謝されたとき", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_1d", label: "自分の専門知識が深まったとき", typeId: "type_hr_d", score: 1 },
  ]},
  { id: "q_hr_2", text: "新しいプロジェクトを任されたとき、まず何をする？", choices: [
    { id: "q_hr_2a", label: "過去の成功事例を参考にすぐ動く", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_2b", label: "学習リソースを集めて準備する", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_2c", label: "チームメンバーと役割分担を確認する", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_2d", label: "その分野の専門知識を深掘りする", typeId: "type_hr_d", score: 1 },
  ]},
  { id: "q_hr_3", text: "困難な課題に直面したときの対応は？", choices: [
    { id: "q_hr_3a", label: "経験を活かして素早く解決策を出す", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_3b", label: "調べて学びながら解決方法を模索する", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_3c", label: "周囲と協力して一緒に取り組む", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_3d", label: "専門的な観点から徹底的に分析する", typeId: "type_hr_d", score: 1 },
  ]},
  { id: "q_hr_4", text: "理想の職場環境は？", choices: [
    { id: "q_hr_4a", label: "成果が正当に評価されるスピード感のある環境", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_4b", label: "研修制度が充実し成長機会が豊富な環境", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_4c", label: "チームワークが良く安定した雰囲気の環境", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_4d", label: "専門性を深められ裁量が大きい環境", typeId: "type_hr_d", score: 1 },
  ]},
  { id: "q_hr_5", text: "チームでの自分の役割として最も近いのは？", choices: [
    { id: "q_hr_5a", label: "リーダーとして引っ張る推進役", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_5b", label: "新しいアイデアを提案する発想役", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_5c", label: "メンバー間をつなぐ調整・サポート役", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_5d", label: "専門知識で技術面を支えるアドバイザー役", typeId: "type_hr_d", score: 1 },
  ]},
  { id: "q_hr_6", text: "キャリアで最も大切にしていることは？", choices: [
    { id: "q_hr_6a", label: "実績と成果を積み上げること", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_6b", label: "常に新しいスキルを身につけること", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_6c", label: "信頼関係を築き長く働けること", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_6d", label: "専門分野で第一人者になること", typeId: "type_hr_d", score: 1 },
  ]},
  { id: "q_hr_7", text: "上司からのフィードバックで最も嬉しいのは？", choices: [
    { id: "q_hr_7a", label: "即戦力として頼りにしていると言われる", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_7b", label: "成長スピードが速いと褒められる", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_7c", label: "チームに欠かせない存在と認められる", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_7d", label: "専門知識の深さを評価される", typeId: "type_hr_d", score: 1 },
  ]},
  { id: "q_hr_8", text: "転職や異動を考えるきっかけは？", choices: [
    { id: "q_hr_8a", label: "今のスキルをもっと活かせる場を求めて", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_8b", label: "新しい分野に挑戦して成長したい", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_8c", label: "人間関係や組織文化が合わないとき", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_8d", label: "専門性をさらに磨ける環境を探して", typeId: "type_hr_d", score: 1 },
  ]},
  { id: "q_hr_9", text: "仕事で最も得意なことは？", choices: [
    { id: "q_hr_9a", label: "短期間で確実に成果を出すこと", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_9b", label: "未経験の領域でも素早くキャッチアップすること", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_9c", label: "メンバーと良好な関係を築き協力すること", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_9d", label: "複雑な問題を専門的に解決すること", typeId: "type_hr_d", score: 1 },
  ]},
  { id: "q_hr_10", text: "5年後の自分の理想像は？", choices: [
    { id: "q_hr_10a", label: "実績豊富なプロフェッショナルとして活躍", typeId: "type_hr_a", score: 1 },
    { id: "q_hr_10b", label: "複数の分野に精通した多能型人材", typeId: "type_hr_b", score: 1 },
    { id: "q_hr_10c", label: "組織に信頼される中核メンバー", typeId: "type_hr_c", score: 1 },
    { id: "q_hr_10d", label: "専門領域のエキスパート・第一人者", typeId: "type_hr_d", score: 1 },
  ]},
];

// --- 全タイプ・全質問の統合 ---
const ALL_TYPES = [...TYPES_STANDARD, ...TYPES_KIDS, ...TYPES_HR];
const ALL_QUESTIONS = [...QUESTIONS_STANDARD, ...QUESTIONS_KIDS, ...QUESTIONS_HR];

// --- 初期フォーム3種 ---
const INITIAL_FORMS = [
  {
    id: "form_default",
    name: "採用分析マッチングフロー",
    slug: "matching",
    description: "あなたの行動パターンから、4つの性格タイプを診断します。MBTI分類に基づいたマッチング分析です。",
    questionIds: QUESTIONS_STANDARD.map((q) => q.id),
    typeIds: TYPES_STANDARD.map((t) => t.id),
    showResultToRespondent: true,
    showScoreDetails: true,
    createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: "form_kids",
    name: "キッズブランド集客と顧客ペルソナ分析",
    slug: "kids",
    description: "お子さまをお持ちの保護者の方向け。婚礼クラスター派生型のライフスタイルとニーズを分析します。",
    questionIds: QUESTIONS_KIDS.map((q) => q.id),
    typeIds: TYPES_KIDS.map((t) => t.id),
    showResultToRespondent: true,
    showScoreDetails: true,
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: "form_hr",
    name: "人事採用テスト",
    slug: "hr",
    description: "採用候補者の強みと職場適性を分析します。面接前の事前診断としてご活用ください。",
    questionIds: QUESTIONS_HR.map((q) => q.id),
    typeIds: TYPES_HR.map((t) => t.id),
    showResultToRespondent: false,
    showScoreDetails: false,
    createdAt: Date.now() - 86400000 * 1,
  },
];

// --- デモ用回答データ（5件） ---
const INITIAL_RESPONSES = [
  {
    id: "res_demo1", formId: "form_default", formTitle: "性格診断フォーム（標準版）",
    respondentInfo: { date: "2025-03-10", department: "営業部", name: "田中 太郎", email: "tanaka@example.com" },
    answers: { q1: "q1a", q2: "q2a", q3: "q3a", q4: "q4a", q5: "q5a", q6: "q6a", q7: "q7b", q8: "q8a", q9: "q9a", q10: "q10a" },
    answerLabels: {
      q1: { questionText: "休日、急に予定が空いたら？", choiceLabel: "誰かに連絡して会う", typeLabel: "コミュニケーション重視タイプ" },
      q2: { questionText: "新しいお店やサービスを知ったとき", choiceLabel: "誰かのおすすめを聞いてみる", typeLabel: "コミュニケーション重視タイプ" },
      q3: { questionText: "旅行やお出かけの計画は？", choiceLabel: "誰と行くかを一番大事にする", typeLabel: "コミュニケーション重視タイプ" },
      q4: { questionText: "初めての場所に行くとき", choiceLabel: "周りの人の動きを見て行動する", typeLabel: "コミュニケーション重視タイプ" },
      q5: { questionText: "待ち時間ができたら？", choiceLabel: "人と話す・連絡を取る", typeLabel: "コミュニケーション重視タイプ" },
      q6: { questionText: "買い物をするときの決め方", choiceLabel: "誰かと相談しながら決める", typeLabel: "コミュニケーション重視タイプ" },
      q7: { questionText: "新しい趣味に興味を持ったら？", choiceLabel: "まず調べて向いてるか考える", typeLabel: "分析型タイプ" },
      q8: { questionText: "予定が変更になったとき", choiceLabel: "周囲と話して調整する", typeLabel: "コミュニケーション重視タイプ" },
      q9: { questionText: "知らないことに出会ったら", choiceLabel: "人に聞く", typeLabel: "コミュニケーション重視タイプ" },
      q10: { questionText: "一日の終わりに満足感を感じるのは？", choiceLabel: "人と話せた日", typeLabel: "コミュニケーション重視タイプ" },
    },
    resultTypeId: "type_a", resultTypeLabel: "コミュニケーション重視タイプ", resultTypeIcon: "💬",
    submittedAt: "2025-03-10T10:30:00.000Z",
  },
  {
    id: "res_demo2", formId: "form_default", formTitle: "性格診断フォーム（標準版）",
    respondentInfo: { date: "2025-03-11", department: "開発部", name: "鈴木 花子", email: "suzuki@example.com" },
    answers: { q1: "q1b", q2: "q2b", q3: "q3b", q4: "q4b", q5: "q5b", q6: "q6b", q7: "q7b", q8: "q8b", q9: "q9b", q10: "q10b" },
    answerLabels: {
      q1: { questionText: "休日、急に予定が空いたら？", choiceLabel: "何をするか少し考えてから決める", typeLabel: "分析型タイプ" },
      q2: { questionText: "新しいお店やサービスを知ったとき", choiceLabel: "口コミや評価をチェックする", typeLabel: "分析型タイプ" },
      q3: { questionText: "旅行やお出かけの計画は？", choiceLabel: "事前にルートや時間を調べる", typeLabel: "分析型タイプ" },
      q4: { questionText: "初めての場所に行くとき", choiceLabel: "地図や案内を事前に確認する", typeLabel: "分析型タイプ" },
      q5: { questionText: "待ち時間ができたら？", choiceLabel: "情報を調べたり考え事をする", typeLabel: "分析型タイプ" },
      q6: { questionText: "買い物をするときの決め方", choiceLabel: "比較して納得してから買う", typeLabel: "分析型タイプ" },
      q7: { questionText: "新しい趣味に興味を持ったら？", choiceLabel: "まず調べて向いてるか考える", typeLabel: "分析型タイプ" },
      q8: { questionText: "予定が変更になったとき", choiceLabel: "状況を整理して考える", typeLabel: "分析型タイプ" },
      q9: { questionText: "知らないことに出会ったら", choiceLabel: "自分で調べる", typeLabel: "分析型タイプ" },
      q10: { questionText: "一日の終わりに満足感を感じるのは？", choiceLabel: "理解が深まった日", typeLabel: "分析型タイプ" },
    },
    resultTypeId: "type_b", resultTypeLabel: "分析型タイプ", resultTypeIcon: "🔍",
    submittedAt: "2025-03-11T14:15:00.000Z",
  },
  {
    id: "res_demo3", formId: "form_kids", formTitle: "キッズブランド顧客ペルソナ診断",
    respondentInfo: { date: "2025-03-12", department: "マーケティング部", name: "佐藤 美咲", email: "sato@example.com" },
    answers: { q_kids_1: "q_kids_1c", q_kids_2: "q_kids_2c", q_kids_3: "q_kids_3c", q_kids_4: "q_kids_4c", q_kids_5: "q_kids_5c", q_kids_6: "q_kids_6c" },
    answerLabels: {
      q_kids_1: { questionText: "週末の過ごし方として最も近いのは？", choiceLabel: "おしゃれなカフェや話題スポットに出かける", typeLabel: "トレンド感度型" },
      q_kids_2: { questionText: "子ども向け商品を選ぶとき、一番重視することは？", choiceLabel: "デザインがかわいい・人気があるか", typeLabel: "トレンド感度型" },
      q_kids_3: { questionText: "子どもの習い事を選ぶ基準は？", choiceLabel: "今話題の習い事・SNSで見かけたもの", typeLabel: "トレンド感度型" },
      q_kids_4: { questionText: "子どものお誕生日会をするなら？", choiceLabel: "映えるデコレーションやテーマパーティ", typeLabel: "トレンド感度型" },
      q_kids_5: { questionText: "新しいキッズブランドを知るきっかけは？", choiceLabel: "InstagramやTikTokで見かけた", typeLabel: "トレンド感度型" },
      q_kids_6: { questionText: "家族で大切にしている価値観は？", choiceLabel: "おしゃれで洗練されたライフスタイル", typeLabel: "トレンド感度型" },
    },
    resultTypeId: "type_kids_c", resultTypeLabel: "トレンド感度型", resultTypeIcon: "✨",
    submittedAt: "2025-03-12T09:00:00.000Z",
  },
  {
    id: "res_demo4", formId: "form_hr", formTitle: "人事採用適性診断",
    respondentInfo: { date: "2025-03-13", department: "", name: "山田 健一", email: "yamada@example.com" },
    answers: { q_hr_1: "q_hr_1a", q_hr_2: "q_hr_2a", q_hr_3: "q_hr_3a", q_hr_4: "q_hr_4a", q_hr_5: "q_hr_5a", q_hr_6: "q_hr_6a", q_hr_7: "q_hr_7a", q_hr_8: "q_hr_8a", q_hr_9: "q_hr_9a", q_hr_10: "q_hr_10a" },
    answerLabels: {
      q_hr_1: { questionText: "仕事でやりがいを感じる場面は？", choiceLabel: "即座に結果を出せたとき", typeLabel: "即戦力型" },
      q_hr_2: { questionText: "新しいプロジェクトを任されたとき、まず何をする？", choiceLabel: "過去の成功事例を参考にすぐ動く", typeLabel: "即戦力型" },
      q_hr_3: { questionText: "困難な課題に直面したときの対応は？", choiceLabel: "経験を活かして素早く解決策を出す", typeLabel: "即戦力型" },
      q_hr_4: { questionText: "理想の職場環境は？", choiceLabel: "成果が正当に評価されるスピード感のある環境", typeLabel: "即戦力型" },
      q_hr_5: { questionText: "チームでの自分の役割として最も近いのは？", choiceLabel: "リーダーとして引っ張る推進役", typeLabel: "即戦力型" },
      q_hr_6: { questionText: "キャリアで最も大切にしていることは？", choiceLabel: "実績と成果を積み上げること", typeLabel: "即戦力型" },
      q_hr_7: { questionText: "上司からのフィードバックで最も嬉しいのは？", choiceLabel: "即戦力として頼りにしていると言われる", typeLabel: "即戦力型" },
      q_hr_8: { questionText: "転職や異動を考えるきっかけは？", choiceLabel: "今のスキルをもっと活かせる場を求めて", typeLabel: "即戦力型" },
      q_hr_9: { questionText: "仕事で最も得意なことは？", choiceLabel: "短期間で確実に成果を出すこと", typeLabel: "即戦力型" },
      q_hr_10: { questionText: "5年後の自分の理想像は？", choiceLabel: "実績豊富なプロフェッショナルとして活躍", typeLabel: "即戦力型" },
    },
    resultTypeId: "type_hr_a", resultTypeLabel: "即戦力型", resultTypeIcon: "🚀",
    submittedAt: "2025-03-13T16:45:00.000Z",
  },
  {
    id: "res_demo5", formId: "form_hr", formTitle: "人事採用適性診断",
    respondentInfo: { date: "2025-03-14", department: "", name: "中村 裕子", email: "nakamura@example.com" },
    answers: { q_hr_1: "q_hr_1b", q_hr_2: "q_hr_2b", q_hr_3: "q_hr_3b", q_hr_4: "q_hr_4b", q_hr_5: "q_hr_5b", q_hr_6: "q_hr_6b", q_hr_7: "q_hr_7b", q_hr_8: "q_hr_8b", q_hr_9: "q_hr_9b", q_hr_10: "q_hr_10b" },
    answerLabels: {
      q_hr_1: { questionText: "仕事でやりがいを感じる場面は？", choiceLabel: "新しいことを学び成長を感じたとき", typeLabel: "成長志向型" },
      q_hr_2: { questionText: "新しいプロジェクトを任されたとき、まず何をする？", choiceLabel: "学習リソースを集めて準備する", typeLabel: "成長志向型" },
      q_hr_3: { questionText: "困難な課題に直面したときの対応は？", choiceLabel: "調べて学びながら解決方法を模索する", typeLabel: "成長志向型" },
      q_hr_4: { questionText: "理想の職場環境は？", choiceLabel: "研修制度が充実し成長機会が豊富な環境", typeLabel: "成長志向型" },
      q_hr_5: { questionText: "チームでの自分の役割として最も近いのは？", choiceLabel: "新しいアイデアを提案する発想役", typeLabel: "成長志向型" },
      q_hr_6: { questionText: "キャリアで最も大切にしていることは？", choiceLabel: "常に新しいスキルを身につけること", typeLabel: "成長志向型" },
      q_hr_7: { questionText: "上司からのフィードバックで最も嬉しいのは？", choiceLabel: "成長スピードが速いと褒められる", typeLabel: "成長志向型" },
      q_hr_8: { questionText: "転職や異動を考えるきっかけは？", choiceLabel: "新しい分野に挑戦して成長したい", typeLabel: "成長志向型" },
      q_hr_9: { questionText: "仕事で最も得意なことは？", choiceLabel: "未経験の領域でも素早くキャッチアップすること", typeLabel: "成長志向型" },
      q_hr_10: { questionText: "5年後の自分の理想像は？", choiceLabel: "複数の分野に精通した多能型人材", typeLabel: "成長志向型" },
    },
    resultTypeId: "type_hr_b", resultTypeLabel: "成長志向型", resultTypeIcon: "🌱",
    submittedAt: "2025-03-14T11:20:00.000Z",
  },
];

// ============================================================
// アイコンコンポーネント
// ============================================================
const Icon = ({ name, size = 18 }) => {
  const icons = {
    plus: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>),
    trash: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" /></svg>),
    edit: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>),
    check: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>),
    chevronRight: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>),
    chevronLeft: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>),
    share: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>),
    link: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>),
    copy: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>),
    x: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>),
    home: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>),
    restart: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>),
    lock: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>),
    logout: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>),
    search: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>),
    eye: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>),
    eyeOff: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 01-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>),
    download: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>),
    user: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
    mail: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22 6 12 13 2 6" /></svg>),
  };
  return icons[name] || null;
};

// ============================================================
// スタイル定数
// ============================================================
const S = {
  font: "'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif",
  bg: "#F5F0EB",
  card: "#FFFFFF",
  text: "#2D2A26",
  textMuted: "#8A8580",
  border: "#E5DFD8",
  accent: "#E8845C",
  accentLight: "#FFF3ED",
  shadow: "0 2px 16px rgba(45,42,38,0.06)",
  shadowLg: "0 8px 40px rgba(45,42,38,0.10)",
  radius: "16px",
  radiusSm: "10px",
  danger: "#D4594E",
  dangerLight: "#FEF2F2",
};

// グローバルCSS（全画面共通）
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
  .btn-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(232,132,92,0.25) !important; }
  .card-hover { transition: all 0.2s; }
  .card-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(45,42,38,0.12) !important; }
  .choice-btn { transition: all 0.25s ease; }
  .choice-btn:hover { transform: scale(1.02); border-color: #E8845C !important; background: #FFFAF7 !important; }
  .choice-btn.selected { transform: scale(1.02); border-color: #E8845C !important; background: #FFF3ED !important; }
  .admin-tab { transition: all 0.2s; }
  .admin-tab:hover { background: #F5F0EB; }
  textarea:focus, input:focus, select:focus { outline: none; border-color: #E8845C !important; box-shadow: 0 0 0 3px rgba(232,132,92,0.15) !important; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D5CFC8; border-radius: 3px; }
`;

// --- 共通UIコンポーネント（メインコンポーネントの外に定義してフォーカス喪失を防止） ---
const Input = ({ value, onChange, placeholder, type = "text", style: extraStyle, disabled }) => (
  <input type={type} value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder} disabled={disabled}
    style={{ width: "100%", padding: "10px 14px", borderRadius: S.radiusSm, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: S.font, color: S.text, background: disabled ? "#F0EDE9" : "#FAFAF8", transition: "all 0.2s", ...extraStyle }} />
);
const TextArea = ({ value, onChange, placeholder, rows = 4 }) => (
  <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: "100%", padding: "10px 14px", borderRadius: S.radiusSm, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: S.font, color: S.text, background: "#FAFAF8", resize: "vertical", lineHeight: 1.7, transition: "all 0.2s" }} />
);
const Label = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, color: S.textMuted, marginBottom: 6, letterSpacing: "0.03em" }}>{children}</div>
);
const Modal = ({ title, onClose, onSave, children, width = 560 }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(45,42,38,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose}>
    <div style={{ background: S.card, borderRadius: "20px", width: "90%", maxWidth: width, maxHeight: "85vh", overflow: "auto", boxShadow: S.shadowLg, animation: "scaleIn 0.3s ease-out" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${S.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: S.card, borderRadius: "20px 20px 0 0", zIndex: 1 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: S.text }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: S.textMuted, padding: 4 }}><Icon name="x" size={20} /></button>
      </div>
      <div style={{ padding: "20px 24px" }}>{children}</div>
      {onSave && (
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${S.border}`, display: "flex", justifyContent: "flex-end", gap: 10, position: "sticky", bottom: 0, background: S.card, borderRadius: "0 0 20px 20px" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: S.radiusSm, border: `1.5px solid ${S.border}`, background: S.card, cursor: "pointer", fontSize: 13, fontWeight: 600, color: S.textMuted, fontFamily: S.font }}>キャンセル</button>
          <button onClick={onSave} style={{ padding: "10px 24px", borderRadius: S.radiusSm, border: "none", background: S.accent, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: S.font }}>保存</button>
        </div>
      )}
    </div>
  </div>
);
const Toggle = ({ on, onToggle, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={onToggle}>
    <div style={{ width: 44, height: 24, borderRadius: 12, background: on ? S.accent : "#D5CFC8", position: "relative", transition: "background 0.2s" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: on ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
    </div>
    {label && <span style={{ fontSize: 13, fontWeight: 600, color: on ? S.accent : S.textMuted }}>{label}</span>}
  </div>
);

// SVG円グラフコンポーネント
const PieChart = ({ data, size = 180 }) => {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 8;
  let startAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(startAngle + angle);
    const y2 = cy + r * Math.sin(startAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const midAngle = startAngle + angle / 2;
    const lx = cx + (r * 0.65) * Math.cos(midAngle);
    const ly = cy + (r * 0.65) * Math.sin(midAngle);
    const slice = { ...d, x1, y1, x2, y2, largeArc, lx, ly, angle, startAngle };
    startAngle += angle;
    return slice;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.08))" }}>
      {slices.map((s, i) => (
        <g key={i}>
          <path
            d={`M${cx},${cy} L${s.x1},${s.y1} A${r},${r} 0 ${s.largeArc},1 ${s.x2},${s.y2} Z`}
            fill={s.color} opacity={0.9} stroke="#fff" strokeWidth={2}
          />
          {s.angle > 0.3 && (
            <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 11, fontWeight: 700, fill: "#fff", pointerEvents: "none" }}>
              {Math.round((s.value / total) * 100)}%
            </text>
          )}
        </g>
      ))}
      <circle cx={cx} cy={cy} r={r * 0.38} fill="white" />
      <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 11, fill: "#8A8580", fontWeight: 700 }}>総数</text>
      <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: 16, fill: "#2D2A26", fontWeight: 900 }}>{total}</text>
    </svg>
  );
};

// ============================================================
// メインアプリケーション
// ============================================================
export default function PersonalityDiagnosisApp() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- グローバルデータ ---
  const [types, setTypes] = useState(ALL_TYPES);
  const [questions, setQuestions] = useState(ALL_QUESTIONS);
  const [forms, setForms] = useState(INITIAL_FORMS);
  const [responses, setResponses] = useState([]);
  const [firestoreLoaded, setFirestoreLoaded] = useState(false);
  const [formsLoaded, setFormsLoaded] = useState(false);

  // --- 管理者認証 ---
  const [adminPassword, setAdminPassword] = useState("admin2024");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminLoginInput, setAdminLoginInput] = useState("");
  const [adminLoginError, setAdminLoginError] = useState(false);

  // --- サブ管理者（作成者）認証 ---
  const [creatorPassword, setCreatorPassword] = useState("creator2024");
  const [isCreatorLoggedIn, setIsCreatorLoggedIn] = useState(false);
  const [loggedInCreatorName, setLoggedInCreatorName] = useState("");
  const [creatorLoginNameInput, setCreatorLoginNameInput] = useState("");
  const [creatorLoginPassInput, setCreatorLoginPassInput] = useState("");
  const [creatorLoginError, setCreatorLoginError] = useState(false);
  const [loginTab, setLoginTab] = useState("admin"); // "admin" | "creator"

  // --- 画面制御 ---
  const [mode, setMode] = useState("landing"); // landing | adminLogin | admin | user

  // --- 回答セッション ---
  const [activeFormId, setActiveFormId] = useState(null);
  const [respondentInfo, setRespondentInfo] = useState({
    date: new Date().toISOString().slice(0, 10),
    department: "",
    name: "",
    email: "",
  });
  const [sessionStep, setSessionStep] = useState("info"); // "info" | "questions" | "result"
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [animDir, setAnimDir] = useState("right");

  // --- 管理者UI ---
  const [adminTab, setAdminTab] = useState("responses");
  const [adminSelectedFormId, setAdminSelectedFormId] = useState(INITIAL_FORMS[0]?.id || "");
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [editingForm, setEditingForm] = useState(null);
  const [toast, setToast] = useState(null);

  // --- 回答一覧フィルター ---
  const [responseFilter, setResponseFilter] = useState({
    formId: "all",
    dateFrom: "",
    dateTo: "",
    keyword: "",
  });
  const [viewingResponse, setViewingResponse] = useState(null);

  // --- 設定画面用 ---
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [passwordChangeMsg, setPasswordChangeMsg] = useState("");
  const [newCreatorPasswordInput, setNewCreatorPasswordInput] = useState("");
  const [creatorPasswordChangeMsg, setCreatorPasswordChangeMsg] = useState("");

  // Firestoreから回答データを取得
  const fetchResponses = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "responses"));
      const data = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
      data.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setResponses(data);
      setFirestoreLoaded(true);
    } catch (e) {
      console.error("Firestore読み込みエラー:", e);
      setFirestoreLoaded(true);
    }
  }, []);

  // Firestoreからフォームデータを取得してINITIAL_FORMSとマージ
  const fetchForms = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "forms"));
      if (!snap.empty) {
        const firestoreForms = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
        // INITIAL_FORMSにないフォームのみFirestoreから追加、既存はFirestoreで上書き
        const mergedIds = new Set(firestoreForms.map((f) => f.id));
        const base = INITIAL_FORMS.filter((f) => !mergedIds.has(f.id));
        setForms([...base, ...firestoreForms]);
      }
      setFormsLoaded(true);
    } catch (e) {
      console.error("Firestore フォーム読み込みエラー:", e);
      setFormsLoaded(true);
    }
  }, []);

  // 初回マウント時にFirestoreから取得
  useEffect(() => {
    fetchResponses();
    fetchForms();
  }, [fetchResponses, fetchForms]);

  // --- トースト ---
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // --- アクティブフォーム ---
  const activeForm = forms.find((f) => f.id === activeFormId);
  const activeQuestions = useMemo(() => {
    if (!activeForm) return [];
    return activeForm.questionIds.map((qid) => questions.find((q) => q.id === qid)).filter(Boolean);
  }, [activeForm, questions]);

  // --- 診断結果の計算 ---
  const computeResult = useCallback((form, ansMap) => {
    if (!form) return { scores: {}, topType: null };
    const scores = {};
    form.typeIds.forEach((tid) => (scores[tid] = 0));
    const qs = form.questionIds.map((qid) => questions.find((q) => q.id === qid)).filter(Boolean);
    Object.values(ansMap).forEach((choiceId) => {
      for (const q of qs) {
        const choice = q.choices.find((c) => c.id === choiceId);
        if (choice && scores[choice.typeId] !== undefined) {
          scores[choice.typeId] += choice.score;
        }
      }
    });
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topType = types.find((t) => t.id === sorted[0]?.[0]);
    return { scores, topType };
  }, [questions, types]);

  // --- 診断開始 ---
  const startDiagnosis = (formId, skipNav) => {
    setActiveFormId(formId);
    setCurrentQ(0);
    setAnswers({});
    setSelectedChoice(null);
    setSessionStep("info");
    setRespondentInfo({
      date: new Date().toISOString().slice(0, 10),
      department: "",
      name: "",
      email: "",
    });
    setMode("user");
    if (!skipNav) {
      const f = forms.find((ff) => ff.id === formId);
      if (f && f.slug) navigate("/" + f.slug);
    }
  };

  // --- ルートに基づくフォーム自動選択 ---
  useEffect(() => {
    const path = location.pathname.replace(/^\//, "").replace(/\/$/, "");
    if (path === "admin") {
      if (isAdminLoggedIn || isCreatorLoggedIn) {
        setMode("admin");
      } else {
        setMode("adminLogin");
      }
      return;
    }
    // Firestoreからフォームが読み込まれるまで待つ（早期にlandingへリダイレクトしない）
    if (!formsLoaded) return;
    const matchedForm = forms.find((f) => f.slug === path || f.id === path);
    if (matchedForm && activeFormId !== matchedForm.id) {
      startDiagnosis(matchedForm.id, true);
    } else if (!matchedForm && path !== "" && path !== "admin") {
      setMode("landing");
    }
  }, [location.pathname, isAdminLoggedIn, forms, formsLoaded]);

  // --- 回答者情報入力後 → 質問開始 ---
  const startQuestions = () => {
    setSessionStep("questions");
    setCurrentQ(0);
  };

  // --- 回答選択 ---
  const selectAnswer = (choiceId) => {
    setSelectedChoice(choiceId);
    const q = activeQuestions[currentQ];
    setTimeout(() => {
      const newAnswers = { ...answers, [q.id]: choiceId };
      setAnswers(newAnswers);
      if (currentQ < activeQuestions.length - 1) {
        setAnimDir("right");
        setCurrentQ((p) => p + 1);
        setSelectedChoice(null);
      } else {
        // 最後の質問 → 結果を計算し記録
        const { topType } = computeResult(activeForm, newAnswers);
        // 回答ラベルを生成
        const answerLabels = {};
        activeQuestions.forEach((aq) => {
          const chosenId = newAnswers[aq.id];
          const chosen = aq.choices.find((c) => c.id === chosenId);
          const t = chosen ? types.find((tp) => tp.id === chosen.typeId) : null;
          answerLabels[aq.id] = {
            questionText: aq.text,
            choiceLabel: chosen ? chosen.label : "",
            typeLabel: t ? t.name : "",
          };
        });
        const newResponse = {
          id: "res_" + uid(),
          formId: activeFormId,
          formTitle: activeForm.name,
          respondentInfo: { ...respondentInfo },
          answers: { ...newAnswers },
          answerLabels,
          resultTypeId: topType ? topType.id : "",
          resultTypeLabel: topType ? topType.name : "",
          resultTypeIcon: topType ? topType.icon : "",
          submittedAt: new Date().toISOString(),
        };
        // Firestoreに保存
        addDoc(collection(db, "responses"), newResponse)
          .then(() => console.log("Firestoreに保存完了"))
          .catch((e) => console.error("Firestore保存エラー:", e));
        setResponses((prev) => [...prev, newResponse]);
        setSessionStep("result");
      }
    }, 400);
  };

  const goBack = () => {
    if (currentQ > 0) {
      setAnimDir("left");
      setCurrentQ((p) => p - 1);
      setSelectedChoice(null);
    }
  };

  // --- 結果データ（result画面用） ---
  const resultData = useMemo(() => {
    if (sessionStep !== "result" || !activeForm) return null;
    return computeResult(activeForm, answers);
  }, [sessionStep, activeForm, answers, computeResult]);

  // --- フィルタリングされた回答一覧 ---
  const filteredResponses = useMemo(() => {
    let list = [...responses];
    if (responseFilter.formId !== "all") {
      list = list.filter((r) => r.formId === responseFilter.formId);
    }
    if (responseFilter.dateFrom) {
      list = list.filter((r) => r.respondentInfo.date >= responseFilter.dateFrom);
    }
    if (responseFilter.dateTo) {
      list = list.filter((r) => r.respondentInfo.date <= responseFilter.dateTo);
    }
    if (responseFilter.keyword.trim()) {
      const kw = responseFilter.keyword.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.respondentInfo.name.toLowerCase().includes(kw) ||
          r.respondentInfo.department.toLowerCase().includes(kw)
      );
    }
    list.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    return list;
  }, [responses, responseFilter]);

  // --- 回答サマリー ---
  const responseSummary = useMemo(() => {
    const typeCounts = {};
    filteredResponses.forEach((r) => {
      typeCounts[r.resultTypeLabel] = (typeCounts[r.resultTypeLabel] || 0) + 1;
    });
    return { total: filteredResponses.length, typeCounts };
  }, [filteredResponses]);

  // --- 管理者ハンドラ ---
  const handleAdminLogin = () => {
    if (adminLoginInput === adminPassword) {
      setIsAdminLoggedIn(true);
      setIsCreatorLoggedIn(false);
      setMode("admin");
      setAdminTab("responses");
      setAdminLoginError(false);
      setAdminLoginInput("");
    } else {
      setAdminLoginError(true);
    }
  };

  const handleCreatorLogin = (e) => {
    e?.preventDefault();
    if (!creatorLoginNameInput.trim()) {
      setCreatorLoginError(true);
      return;
    }
    if (creatorLoginPassInput === creatorPassword) {
      setIsCreatorLoggedIn(true);
      setIsAdminLoggedIn(false);
      setLoggedInCreatorName(creatorLoginNameInput.trim());
      setMode("admin");
      setAdminTab("forms");
      setCreatorLoginError(false);
      setCreatorLoginPassInput("");
      setCreatorLoginNameInput("");
    } else {
      setCreatorLoginError(true);
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setIsCreatorLoggedIn(false);
    setLoggedInCreatorName("");
    setMode("landing");
    setAdminTab("forms");
    navigate("/");
  };

  // 質問CRUD
  const addQuestion = () => {
    const newId = "q_" + uid();
    setEditingQuestion({
      id: newId, text: "",
      choices: [
        { id: newId + "_a", label: "", typeId: types[0]?.id || "", score: 1 },
        { id: newId + "_b", label: "", typeId: types[1]?.id || "", score: 1 },
        { id: newId + "_c", label: "", typeId: types[2]?.id || "", score: 1 },
        { id: newId + "_d", label: "", typeId: types[3]?.id || "", score: 1 },
      ],
      isNew: true,
    });
  };
  const saveQuestion = () => {
    if (!editingQuestion || !editingQuestion.text.trim()) return;
    const { isNew, ...q } = editingQuestion;
    if (isNew) setQuestions((prev) => [...prev, q]);
    else setQuestions((prev) => prev.map((p) => (p.id === q.id ? q : p)));
    setEditingQuestion(null);
    showToast("質問を保存しました");
  };
  const deleteQuestion = (id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setForms((prev) => prev.map((f) => ({ ...f, questionIds: f.questionIds.filter((qid) => qid !== id) })));
    showToast("質問を削除しました");
  };

  // タイプCRUD
  const addType = () => {
    setEditingType({ id: "type_" + uid(), name: "", color: "#888888", icon: "🔷", userDescription: "", adminDescription: "", isNew: true });
  };
  const saveType = () => {
    if (!editingType || !editingType.name.trim()) return;
    const { isNew, ...t } = editingType;
    if (isNew) setTypes((prev) => [...prev, t]);
    else setTypes((prev) => prev.map((p) => (p.id === t.id ? t : p)));
    setEditingType(null);
    showToast("タイプを保存しました");
  };
  const deleteType = (id) => {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    setForms((prev) => prev.map((f) => ({ ...f, typeIds: f.typeIds.filter((tid) => tid !== id) })));
    showToast("タイプを削除しました");
  };

  // フォームCRUD
  const addForm = () => {
    const newId = "form_" + uid();
    setEditingForm({ id: newId, slug: newId, name: "", description: "", questionIds: [], typeIds: types.map((t) => t.id), showResultToRespondent: true, showScoreDetails: true, createdAt: Date.now(), isNew: true, creatorName: isCreatorLoggedIn ? loggedInCreatorName : "" });
  };
  const saveForm = async () => {
    if (!editingForm || !editingForm.name.trim()) return;
    const { isNew, _docId, ...f } = editingForm;
    // slugが空なら id を使う
    if (!f.slug) f.slug = f.id;
    try {
      await setDoc(doc(db, "forms", f.id), f);
    } catch (e) {
      console.error("フォーム保存エラー:", e);
    }
    if (isNew) setForms((prev) => [...prev, f]);
    else setForms((prev) => prev.map((p) => (p.id === f.id ? f : p)));
    setEditingForm(null);
    showToast("フォームを保存しました");
  };
  const deleteForm = async (id) => {
    try {
      await deleteDoc(doc(db, "forms", id));
    } catch (e) {
      console.error("フォーム削除エラー:", e);
    }
    setForms((prev) => prev.filter((f) => f.id !== id));
    showToast("フォームを削除しました");
  };

  // 結果表示トグル
  const toggleShowResult = (formId) => {
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, showResultToRespondent: !f.showResultToRespondent } : f));
  };

  // スコア内訳表示トグル
  const toggleShowScoreDetails = (formId) => {
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, showScoreDetails: !(f.showScoreDetails ?? true) } : f));
  };

  // 回答削除（Firestore連携）
  const deleteResponse = async (id) => {
    if (!window.confirm("この回答データを削除しますか？")) return;
    // Firestoreから削除
    const target = responses.find((r) => r.id === id);
    if (target && target._docId) {
      try {
        await deleteDoc(doc(db, "responses", target._docId));
      } catch (e) {
        console.error("Firestore削除エラー:", e);
      }
    }
    setResponses((prev) => prev.filter((r) => r.id !== id));
    setViewingResponse(null);
    showToast("回答データを削除しました");
  };

  // ============================================================
  // フォーム読み込み中（URL直リンク時のフラッシュ防止）
  // ============================================================
  const currentUrlPath = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  if (!formsLoaded && currentUrlPath && currentUrlPath !== "admin") {
    return (
      <div style={{ fontFamily: S.font, background: `linear-gradient(160deg, #F5F0EB 0%, #EDE6DD 100%)`, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ textAlign: "center", animation: "fadeUp 0.6s ease-out" }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "float 2s ease-in-out infinite" }}>🪞</div>
          <div style={{ fontSize: 14, color: S.textMuted, fontWeight: 500 }}>読み込み中...</div>
        </div>
      </div>
    );
  }

  // ============================================================
  // ランディング画面
  // ============================================================
  if (mode === "landing") {
    return (
      <div style={{ fontFamily: S.font, background: `linear-gradient(160deg, #F5F0EB 0%, #EDE6DD 50%, #F0E8DF 100%)`, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ position: "fixed", top: "10%", left: "5%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,132,92,0.08) 0%, transparent 70%)", animation: "float 6s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: "15%", right: "8%", width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(91,141,184,0.08) 0%, transparent 70%)", animation: "float 8s ease-in-out infinite 1s", pointerEvents: "none" }} />

        <div style={{ animation: "fadeUp 0.8s ease-out", textAlign: "center", maxWidth: 580, width: "100%" }}>
          <div style={{ fontSize: 48, marginBottom: 12, animation: "float 4s ease-in-out infinite" }}>🪞</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: S.text, letterSpacing: "-0.02em", marginBottom: 8 }}>性格診断システム</h1>
          <p style={{ fontSize: 15, color: S.textMuted, lineHeight: 1.7, marginBottom: 36 }}>目的に合わせた診断フォームを選んで回答してください</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
            {forms.map((form, i) => {
              const fTypes = form.typeIds.map((tid) => types.find((t) => t.id === tid)).filter(Boolean);
              return (
                <div key={form.id} className="card-hover" onClick={() => startDiagnosis(form.id)}
                  style={{ background: S.card, borderRadius: S.radius, padding: "20px 24px", cursor: "pointer", boxShadow: S.shadow, textAlign: "left", transition: "all 0.3s ease", animation: `fadeUp 0.6s ease-out ${i * 0.1}s both`, border: `1px solid ${S.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: S.text, marginBottom: 4 }}>{form.name}</div>
                      <div style={{ fontSize: 13, color: S.textMuted, marginBottom: 8, lineHeight: 1.5 }}>{form.description}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: S.accentLight, color: S.accent, fontWeight: 600 }}>{form.questionIds.length}問</span>
                        {fTypes.slice(0, 4).map((t) => (
                          <span key={t.id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: t.color + "14", color: t.color, fontWeight: 500 }}>{t.icon} {t.name}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ color: S.accent, display: "flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 600, marginLeft: 16, flexShrink: 0 }}>
                      診断する <Icon name="chevronRight" size={16} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={() => { navigate("/admin"); setAdminLoginInput(""); setAdminLoginError(false); setMode("adminLogin"); }}
            style={{ background: "transparent", border: `1.5px solid ${S.border}`, borderRadius: S.radiusSm, padding: "12px 28px", fontSize: 14, color: S.textMuted, cursor: "pointer", fontFamily: S.font, fontWeight: 500, transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 8 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.color = S.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.textMuted; }}>
            <Icon name="lock" size={14} /> 管理者ログイン
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // 管理者ログイン画面
  // ============================================================
  if (mode === "adminLogin") {
    return (
      <div style={{ fontFamily: S.font, background: `linear-gradient(160deg, #F5F0EB 0%, #EDE6DD 100%)`, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ background: S.card, borderRadius: "24px", padding: "40px 36px", boxShadow: S.shadowLg, maxWidth: 400, width: "100%", animation: "scaleIn 0.4s ease-out", border: `1px solid ${S.border}` }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: S.text, letterSpacing: "-0.01em" }}>ログイン</h2>
          </div>

          {/* タブ切り替え */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, padding: 4, background: S.bg, borderRadius: S.radiusSm }}>
            <button onClick={() => { setLoginTab("admin"); setAdminLoginError(false); }} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: loginTab === "admin" ? S.card : "transparent", boxShadow: loginTab === "admin" ? S.shadowSm : "none", fontSize: 13, fontWeight: 700, color: loginTab === "admin" ? S.accent : S.textMuted, cursor: "pointer", transition: "all 0.2s" }}>システム管理者</button>
            <button onClick={() => { setLoginTab("creator"); setCreatorLoginError(false); }} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: loginTab === "creator" ? S.card : "transparent", boxShadow: loginTab === "creator" ? S.shadowSm : "none", fontSize: 13, fontWeight: 700, color: loginTab === "creator" ? S.accent : S.textMuted, cursor: "pointer", transition: "all 0.2s" }}>フォーム作成者</button>
          </div>

          {loginTab === "admin" ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <input
                  type="password" value={adminLoginInput} placeholder="システム管理者パスワード"
                  onChange={(e) => { setAdminLoginInput(e.target.value); setAdminLoginError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: S.radiusSm, border: `1.5px solid ${adminLoginError ? S.danger : S.border}`, fontSize: 15, fontFamily: S.font, color: S.text, background: "#FAFAF8", transition: "all 0.2s" }}
                />
              </div>
              {adminLoginError && <div style={{ color: S.danger, fontSize: 13, marginBottom: 16, fontWeight: 600, textAlign: "center" }}>パスワードが正しくありません</div>}
              <button onClick={handleAdminLogin}
                style={{ width: "100%", padding: "14px", borderRadius: S.radiusSm, border: "none", background: S.accent, cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: S.font, marginBottom: 12 }}>
                ログイン
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreatorLogin}>
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text" value={creatorLoginNameInput} placeholder="あなたの名前（作成者名）"
                  onChange={(e) => { setCreatorLoginNameInput(e.target.value); setCreatorLoginError(false); }}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: S.radiusSm, border: `1.5px solid ${creatorLoginError && !creatorLoginNameInput ? S.danger : S.border}`, fontSize: 15, fontFamily: S.font, color: S.text, background: "#FAFAF8", transition: "all 0.2s" }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <input
                  type="password" value={creatorLoginPassInput} placeholder="作成者用共通パスワード"
                  onChange={(e) => { setCreatorLoginPassInput(e.target.value); setCreatorLoginError(false); }}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: S.radiusSm, border: `1.5px solid ${creatorLoginError && creatorLoginNameInput ? S.danger : S.border}`, fontSize: 15, fontFamily: S.font, color: S.text, background: "#FAFAF8", transition: "all 0.2s" }}
                />
              </div>
              {creatorLoginError && <div style={{ color: S.danger, fontSize: 13, marginBottom: 16, fontWeight: 600, textAlign: "center" }}>名前とパスワードを確認してください</div>}
              <button type="submit"
                style={{ width: "100%", padding: "14px", borderRadius: S.radiusSm, border: "none", background: S.accent, cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: S.font, marginBottom: 12 }}>
                ログイン
              </button>
            </form>
          )}

          <button onClick={() => { setMode("landing"); navigate("/"); }}
            style={{ width: "100%", padding: "12px", borderRadius: S.radiusSm, border: `1.5px solid ${S.border}`, background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 500, color: S.textMuted, fontFamily: S.font }}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // ユーザー画面
  // ============================================================
  if (mode === "user") {
    // --- ステップ0: 回答者情報入力 ---
    if (sessionStep === "info") {
      return (
        <div style={{ fontFamily: S.font, background: `linear-gradient(160deg, #F5F0EB 0%, #EDE6DD 100%)`, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <style>{GLOBAL_CSS}</style>
          <div style={{ background: S.card, borderRadius: "24px", padding: "36px 32px", boxShadow: S.shadowLg, maxWidth: 480, width: "100%", animation: "fadeUp 0.6s ease-out", border: `1px solid ${S.border}` }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{activeForm ? "📝" : "🪞"}</div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: S.text, marginBottom: 4 }}>{activeForm?.name || "診断"}</h2>
              <p style={{ fontSize: 13, color: S.textMuted, lineHeight: 1.6 }}>{activeForm?.description}</p>
            </div>

            <div style={{ padding: "16px 0 0", borderTop: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.text, marginBottom: 16 }}>回答者情報を入力してください</div>

              <div style={{ marginBottom: 14 }}>
                <Label>回答日</Label>
                <Input type="date" value={respondentInfo.date} onChange={(v) => setRespondentInfo((p) => ({ ...p, date: v }))} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <Label>所属部署</Label>
                <Input value={respondentInfo.department} onChange={(v) => setRespondentInfo((p) => ({ ...p, department: v }))} placeholder="例：営業部" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <Label>氏名 <span style={{ color: S.danger, fontSize: 11 }}>*必須</span></Label>
                <Input value={respondentInfo.name} onChange={(v) => setRespondentInfo((p) => ({ ...p, name: v }))} placeholder="例：田中 太郎" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <Label>メールアドレス（任意）</Label>
                <Input type="email" value={respondentInfo.email} onChange={(v) => setRespondentInfo((p) => ({ ...p, email: v }))} placeholder="例：tanaka@example.com" />
              </div>

              <button onClick={startQuestions} disabled={!respondentInfo.name.trim()}
                style={{ width: "100%", padding: "14px", borderRadius: S.radiusSm, border: "none", background: respondentInfo.name.trim() ? S.accent : "#D5CFC8", cursor: respondentInfo.name.trim() ? "pointer" : "not-allowed", fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: S.font, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                次へ → 診断開始 <Icon name="chevronRight" size={16} />
              </button>
              <button onClick={() => { setMode("landing"); navigate("/"); }}
                style={{ width: "100%", padding: "10px", borderRadius: S.radiusSm, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: S.textMuted, fontFamily: S.font, marginTop: 8 }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      );
    }

    // --- 結果画面 ---
    if (sessionStep === "result" && resultData) {
      const { scores, topType } = resultData;
      const maxScore = activeQuestions.length;
      const showResult = activeForm?.showResultToRespondent;

      return (
        <div style={{ fontFamily: S.font, background: `linear-gradient(160deg, #F5F0EB 0%, #EDE6DD 100%)`, minHeight: "100vh", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <style>{GLOBAL_CSS}</style>
          <div style={{ maxWidth: 520, width: "100%", paddingTop: 32 }}>
            {showResult && topType ? (
              <>
                {/* 結果表示ON */}
                <div style={{ textAlign: "center", animation: "fadeUp 0.6s ease-out", marginBottom: 24 }}>
                  <div style={{ fontSize: 14, color: S.textMuted, fontWeight: 500, marginBottom: 8, letterSpacing: "0.1em" }}>あなたの診断結果</div>
                  <div style={{ fontSize: 64, animation: "scaleIn 0.8s ease-out 0.3s both" }}>{topType.icon}</div>
                </div>
                <div style={{ background: S.card, borderRadius: "20px", padding: "32px 28px", boxShadow: S.shadowLg, animation: "fadeUp 0.8s ease-out 0.2s both", marginBottom: 20, border: `1px solid ${S.border}` }}>
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ display: "inline-block", padding: "6px 20px", borderRadius: "24px", background: topType.color + "18", color: topType.color, fontWeight: 700, fontSize: 20 }}>{topType.name}</div>
                  </div>
                  <div style={{ fontSize: 14.5, lineHeight: 2, color: S.text, whiteSpace: "pre-line" }}>{topType.userDescription}</div>
                </div>
                {(activeForm?.showScoreDetails ?? true) && (
                  <div style={{ background: S.card, borderRadius: "20px", padding: "24px 28px", boxShadow: S.shadow, animation: "fadeUp 0.8s ease-out 0.4s both", marginBottom: 24, border: `1px solid ${S.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 16, letterSpacing: "0.05em" }}>スコア内訳</div>
                    {types.filter((t) => activeForm.typeIds.includes(t.id)).map((t) => {
                      const score = scores[t.id] || 0;
                      const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
                      return (
                        <div key={t.id} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{t.icon} {t.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{score}/{maxScore}</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: S.bg, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${t.color}, ${t.color}cc)`, width: `${pct}%`, transition: "width 1s ease-out" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* 結果表示OFF */}
                <div style={{ textAlign: "center", animation: "fadeUp 0.8s ease-out", padding: "60px 20px" }}>
                  <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, color: S.text, marginBottom: 12 }}>回答が送信されました</h2>
                  <p style={{ fontSize: 15, color: S.textMuted, lineHeight: 1.8 }}>ご回答ありがとうございました。<br />結果はご担当者よりお知らせします。</p>
                </div>
              </>
            )}

          </div>
        </div>
      );
    }

    // --- 質問画面 ---
    const q = activeQuestions[currentQ];
    if (!q) return null;
    const progress = ((currentQ + 1) / activeQuestions.length) * 100;

    return (
      <div style={{ fontFamily: S.font, background: `linear-gradient(160deg, #F5F0EB 0%, #EDE6DD 100%)`, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button onClick={() => currentQ === 0 ? setSessionStep("info") : goBack()}
              style={{ background: "none", border: "none", cursor: "pointer", color: S.textMuted, display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontFamily: S.font, fontWeight: 500 }}>
              <Icon name="chevronLeft" size={16} /> {currentQ === 0 ? "情報入力に戻る" : "前の質問"}
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: S.accent }}>{currentQ + 1} / {activeQuestions.length}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: S.border }}>
            <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${S.accent}, #F4A77B)`, width: `${progress}%`, transition: "width 0.5s ease" }} />
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
          <div key={q.id} style={{ maxWidth: 480, width: "100%", animation: animDir === "right" ? "slideIn 0.4s ease-out" : "slideInLeft 0.4s ease-out" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 13, color: S.textMuted, fontWeight: 500, marginBottom: 8, letterSpacing: "0.05em" }}>Q{currentQ + 1}</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: S.text, letterSpacing: "-0.02em", lineHeight: 1.5 }}>{q.text}</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {q.choices.map((c, i) => {
                const isSelected = selectedChoice === c.id || answers[q.id] === c.id;
                const labels = ["A", "B", "C", "D", "E", "F"];
                return (
                  <button key={c.id} className={`choice-btn ${isSelected ? "selected" : ""}`} onClick={() => selectAnswer(c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: S.radiusSm, border: `1.5px solid ${isSelected ? S.accent : S.border}`, background: isSelected ? S.accentLight : S.card, cursor: "pointer", textAlign: "left", fontFamily: S.font, boxShadow: isSelected ? `0 4px 16px ${S.accent}20` : S.shadow }}>
                    <span style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0, background: isSelected ? S.accent : S.bg, color: isSelected ? "#fff" : S.textMuted, transition: "all 0.2s" }}>
                      {isSelected ? <Icon name="check" size={14} /> : labels[i]}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 500, color: S.text, lineHeight: 1.5 }}>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 管理者画面
  // ============================================================
  const adminSelectedForm = forms.find((f) => f.id === adminSelectedFormId);

  const adminTabsAll = [
    { key: "responses", label: "回答一覧", icon: "📊" },
    { key: "questions", label: "質問管理", icon: "📝" },
    { key: "types", label: "タイプ管理", icon: "🏷️" },
    { key: "forms", label: "フォーム管理", icon: "📋" },
    { key: "settings", label: "設定", icon: "⚙️" },
  ];
  const adminTabs = isCreatorLoggedIn ? adminTabsAll.filter((t) => ["questions", "types", "forms"].includes(t.key)) : adminTabsAll;

  const visibleForms = isCreatorLoggedIn ? forms.filter((f) => f.creatorName === loggedInCreatorName) : forms;

  // 管理者質問一覧のフォーム別フィルター用
  const getFormForQuestion = (qId) => visibleForms.filter((f) => f.questionIds.includes(qId));

  // --- CSVダウンロード処理 ---
  const handleDownloadCSV = () => {
    if (!adminSelectedForm) return showToast("フォームを選択してください");
    const targetResponses = filteredResponses.filter((r) => r.formId === adminSelectedFormId);
    if (targetResponses.length === 0) return showToast("ダウンロードするデータがありません");

    // 全ての質問列のヘッダーを作成
    const headerRow = ["回答日時", "所属", "氏名", "結果タイプ", "タイプ数"];
    const formQs = adminSelectedForm.questionIds.map(qid => questions.find(q => q.id === qid)).filter(Boolean);
    formQs.forEach((q, i) => {
      headerRow.push(`Q${i + 1} 質問`);
      headerRow.push(`Q${i + 1} 回答`);
      headerRow.push(`Q${i + 1} タイプ`);
    });

    const rows = [headerRow.map((v) => `"${v}"`).join(",")];

    targetResponses.forEach((r) => {
      const typeCount = targetResponses.filter((fr) => fr.resultTypeId === r.resultTypeId).length;
      const dateStr = new Date(r.submittedAt).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      const baseRow = [
        dateStr,
        r.respondentInfo.department || "",
        r.respondentInfo.name,
        r.resultTypeLabel,
        typeCount
      ];

      // 回答内容を順に取得
      const qData = [];
      formQs.forEach((q) => {
        const ans = r.answerLabels[q.id];
        if (ans) {
          qData.push(ans.questionText || "");
          qData.push(ans.choiceLabel || "");
          qData.push(ans.typeLabel || "");
        } else {
          qData.push("", "", "");
        }
      });

      const row = [...baseRow, ...qData].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      rows.push(row);
    });

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${adminSelectedForm.name}_回答データ_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSVをダウンロードしました");
  };

  return (
    <div style={{ fontFamily: S.font, background: S.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ヘッダー */}
      <div style={{ background: S.card, borderBottom: `1px solid ${S.border}`, padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚙️</span>
              <span style={{ fontWeight: 900, fontSize: 16, color: S.text }}>
                {isCreatorLoggedIn ? `フォーム作成者: ${loggedInCreatorName}` : "管理者ダッシュボード"}
              </span>
            </div>
            <button onClick={handleAdminLogout}
              style={{ background: "none", border: `1.5px solid ${S.border}`, borderRadius: S.radiusSm, padding: "6px 16px", cursor: "pointer", fontSize: 13, color: S.textMuted, fontFamily: S.font, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="logout" size={14} /> ログアウト
            </button>
          </div>
          {/* フォーム選択バー */}
          {adminTab === "responses" || adminTab === "questions" ? (
            <div style={{ display: "flex", gap: 8, padding: "8px 0", overflowX: "auto", borderBottom: `1px solid ${S.border}` }}>
              {visibleForms.map((f) => (
                <button key={f.id} onClick={() => setAdminSelectedFormId(f.id)}
                  style={{ padding: "6px 16px", borderRadius: 20, border: `1.5px solid ${adminSelectedFormId === f.id ? S.accent : S.border}`, background: adminSelectedFormId === f.id ? S.accentLight : "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: adminSelectedFormId === f.id ? S.accent : S.textMuted, fontFamily: S.font, transition: "all 0.2s", whiteSpace: "nowrap" }}>
                  {f.name}
                </button>
              ))}
              {visibleForms.length === 0 && <span style={{ fontSize: 12, color: S.textMuted, padding: "6px" }}>対象のフォームがありません</span>}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
            {adminTabs.map((tab) => (
              <button key={tab.key} className="admin-tab" onClick={() => setAdminTab(tab.key)}
                style={{ background: adminTab === tab.key ? S.accentLight : "transparent", border: "none", borderBottom: adminTab === tab.key ? `2px solid ${S.accent}` : "2px solid transparent", padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: adminTab === tab.key ? S.accent : S.textMuted, fontFamily: S.font, transition: "all 0.2s", whiteSpace: "nowrap" }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "24px" }}>

        {/* ====== 回答一覧タブ ====== */}
        {adminTab === "responses" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: S.text, marginBottom: 4 }}>回答一覧</h2>
                <p style={{ fontSize: 13, color: S.textMuted }}>選択中: <strong style={{ color: S.accent }}>{adminSelectedForm?.name || "全フォーム"}</strong></p>
              </div>
              <button onClick={handleDownloadCSV}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: S.radiusSm, border: `1px solid ${S.border}`, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: S.text, fontFamily: S.font, boxShadow: S.shadow, alignSelf: "center" }}>
                <Icon name="download" size={15} /> CSVダウンロード
              </button>
            </div>

            {/* フィルター行 */}
            <div style={{ background: S.card, borderRadius: S.radius, padding: "16px 20px", boxShadow: S.shadow, border: `1px solid ${S.border}`, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ minWidth: 180, display: "none" }}>
                <Label>フォーム</Label>
                <select value={adminSelectedFormId} onChange={(e) => setAdminSelectedFormId(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: S.font, color: S.text, background: "#FAFAF8" }}>
                  {forms.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                </select>
              </div>
              <div style={{ minWidth: 140 }}>
                <Label>開始日</Label>
                <input type="date" value={responseFilter.dateFrom} onChange={(e) => setResponseFilter((p) => ({ ...p, dateFrom: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: S.font, color: S.text, background: "#FAFAF8" }} />
              </div>
              <div style={{ minWidth: 140 }}>
                <Label>終了日</Label>
                <input type="date" value={responseFilter.dateTo} onChange={(e) => setResponseFilter((p) => ({ ...p, dateTo: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: S.font, color: S.text, background: "#FAFAF8" }} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <Label>氏名・所属で検索</Label>
                <div style={{ position: "relative" }}>
                  <input value={responseFilter.keyword} onChange={(e) => setResponseFilter((p) => ({ ...p, keyword: e.target.value }))} placeholder="検索..."
                    style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: S.font, color: S.text, background: "#FAFAF8" }} />
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: S.textMuted }}><Icon name="search" size={14} /></span>
                </div>
              </div>
            </div>

            {/* 分析セクション: 円グラフ + サマリー */}
            {(() => {
              const targetResponses = filteredResponses.filter((r) => r.formId === adminSelectedFormId);
              const typeCounts = {};
              targetResponses.forEach((r) => {
                if (r.resultTypeLabel) typeCounts[r.resultTypeId] = (typeCounts[r.resultTypeId] || 0) + 1;
              });
              const pieData = Object.entries(typeCounts).map(([tid, count]) => {
                const t = types.find((tp) => tp.id === tid);
                return { label: t?.name || tid, icon: t?.icon || "", value: count, color: t?.color || "#888" };
              }).sort((a, b) => b.value - a.value);
              const topEntry = pieData[0];
              return (
                <div style={{ background: S.card, borderRadius: S.radius, padding: "20px 24px", boxShadow: S.shadow, border: `1px solid ${S.border}`, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: S.text }}>分析グラフ</div>
                      <div style={{ fontSize: 12, color: S.textMuted, marginTop: 2 }}>絞り込み中: <strong style={{ color: S.accent }}>{adminSelectedForm?.name}</strong> ・ {targetResponses.length}件</div>
                    </div>
                    {topEntry && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: S.textMuted, fontWeight: 600, marginBottom: 2 }}>最多タイプ</div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: (types.find(t=>t.name===topEntry.label)?.color||"#888") + "18", border: `1.5px solid ${types.find(t=>t.name===topEntry.label)?.color||"#888"}` }}>
                          <span style={{ fontSize: 16 }}>{topEntry.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: types.find(t=>t.name===topEntry.label)?.color||"#888" }}>{topEntry.label}</span>
                          <span style={{ fontWeight: 900, fontSize: 15, color: types.find(t=>t.name===topEntry.label)?.color||"#888" }}>{topEntry.value}件</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {pieData.length > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
                      <PieChart data={pieData} size={180} />
                      <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 10 }}>
                        {pieData.map((d) => (
                          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: S.text, flex: 1 }}>{d.icon} {d.label}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: S.bg, overflow: "hidden", minWidth: 60 }}>
                                <div style={{ height: "100%", borderRadius: 3, background: d.color, width: `${(d.value / targetResponses.length) * 100}%`, transition: "width 0.8s ease" }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 900, color: d.color, minWidth: 32, textAlign: "right" }}>{d.value}</span>
                              <span style={{ fontSize: 11, color: S.textMuted, minWidth: 36 }}>({Math.round((d.value / targetResponses.length) * 100)}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "24px 0", color: S.textMuted, fontSize: 13 }}>回答データがありません</div>
                  )}
                </div>
              );
            })()}

            {/* 集計サマリー */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ background: S.card, borderRadius: S.radiusSm, padding: "14px 20px", boxShadow: S.shadow, border: `1px solid ${S.border}`, minWidth: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, marginBottom: 4 }}>総回答数</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: S.accent }}>{responseSummary.total}</div>
              </div>
              {Object.entries(responseSummary.typeCounts).map(([label, count]) => {
                const t = types.find((tp) => tp.name === label);
                return (
                  <div key={label} style={{ background: S.card, borderRadius: S.radiusSm, padding: "14px 20px", boxShadow: S.shadow, border: `1px solid ${S.border}`, borderLeft: `3px solid ${t?.color || "#888"}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, marginBottom: 4 }}>{t?.icon || ""} {label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: t?.color || S.text }}>{count}</div>
                  </div>
                );
              })}
            </div>

            {/* テーブル */}
            <div style={{ background: S.card, borderRadius: S.radius, boxShadow: S.shadow, border: `1px solid ${S.border}`, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${S.border}`, background: "#FAFAF8" }}>
                      {["回答日時", "所属", "氏名", "結果タイプ", "タイプ数", ""].map((h, i) => (
                        <th key={i} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, color: S.textMuted, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResponses.filter((r) => r.formId === adminSelectedFormId).length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: "40px 14px", textAlign: "center", color: S.textMuted }}>回答データがありません</td></tr>
                    ) : filteredResponses.filter((r) => r.formId === adminSelectedFormId).map((r) => {
                      const t = types.find((tp) => tp.id === r.resultTypeId);
                      return (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${S.border}` }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#FAFAF8"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap", color: S.textMuted }}>{new Date(r.submittedAt).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap", color: S.text }}>{r.respondentInfo.department || "—"}</td>
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap", fontWeight: 600, color: S.text }}>{r.respondentInfo.name}</td>
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <span style={{ padding: "4px 10px", borderRadius: 6, background: (t?.color || "#888") + "14", color: t?.color || "#888", fontWeight: 600, fontSize: 12 }}>{r.resultTypeIcon} {r.resultTypeLabel}</span>
                          </td>
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap", textAlign: "center" }}>
                            {(() => {
                              const sameTypeCount = filteredResponses.filter((fr) => fr.formId === adminSelectedFormId && fr.resultTypeId === r.resultTypeId).length;
                              return (
                                <span style={{ display: "inline-block", minWidth: 32, padding: "4px 10px", borderRadius: 20, background: (t?.color || "#888") + "18", color: t?.color || "#888", fontWeight: 900, fontSize: 13 }}>{sameTypeCount}</span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => setViewingResponse(r)}
                                style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${S.border}`, background: S.card, cursor: "pointer", fontSize: 12, fontWeight: 600, color: S.accent, fontFamily: S.font }}>
                                詳細
                              </button>
                              <button onClick={() => deleteResponse(r.id)}
                                style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${S.border}`, background: S.dangerLight, cursor: "pointer", color: S.danger, fontFamily: S.font }}>
                                <Icon name="trash" size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====== 質問管理タブ ====== */}
        {adminTab === "questions" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: S.text }}>質問管理</h2>
                <p style={{ fontSize: 13, color: S.textMuted, marginTop: 4 }}>選択中: <strong style={{ color: S.accent }}>{adminSelectedForm?.name}</strong> — {adminSelectedForm ? adminSelectedForm.questionIds.length : 0}件の質問</p>
              </div>
              <button onClick={addQuestion}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: S.radiusSm, border: "none", background: S.accent, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: S.font }}>
                <Icon name="plus" size={16} /> 質問を追加
              </button>
            </div>
            {/* 選択中フォームの質問表示 */}
            {adminSelectedForm && (() => {
              const formQs = adminSelectedForm.questionIds.map((qid) => questions.find((q) => q.id === qid)).filter(Boolean);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {formQs.map((q, qi) => (
                    <div key={q.id} className="card-hover" style={{ background: S.card, borderRadius: S.radiusSm, padding: "14px 16px", boxShadow: S.shadow, border: `1px solid ${S.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: S.accent, background: S.accentLight, padding: "2px 8px", borderRadius: 6 }}>Q{qi + 1}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{q.text}</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {q.choices.map((c) => {
                              const t = types.find((tp) => tp.id === c.typeId);
                              return (
                                <span key={c.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: (t?.color || "#888") + "14", color: t?.color || "#888", fontWeight: 500 }}>
                                  {c.label} → {t?.name || "?"} (+{c.score})
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, marginLeft: 8, flexShrink: 0 }}>
                          <button onClick={() => setEditingQuestion({ ...q })} style={{ background: S.bg, border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: S.textMuted }}><Icon name="edit" size={14} /></button>
                          <button onClick={() => deleteQuestion(q.id)} style={{ background: S.dangerLight, border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: S.danger }}><Icon name="trash" size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {formQs.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: S.textMuted }}>このフォームにはまだ質問がありません</div>}
                </div>
              );
            })()}
          </div>
        )}

        {/* ====== タイプ管理タブ ====== */}
        {adminTab === "types" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: S.text }}>タイプ管理</h2>
                <p style={{ fontSize: 13, color: S.textMuted, marginTop: 4 }}>選択中: <strong style={{ color: S.accent }}>{adminSelectedForm?.name}</strong> — {adminSelectedForm ? adminSelectedForm.typeIds.length : 0}件のタイプ</p>
              </div>
              <button onClick={addType} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: S.radiusSm, border: "none", background: S.accent, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: S.font }}>
                <Icon name="plus" size={16} /> タイプを追加
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {types.filter((t) => adminSelectedForm?.typeIds.includes(t.id)).map((t, i) => (
                <div key={t.id} className="card-hover" style={{ background: S.card, borderRadius: S.radius, padding: "18px", boxShadow: S.shadow, border: `1px solid ${S.border}`, borderTop: `3px solid ${t.color}`, animation: `fadeUp 0.4s ease-out ${i * 0.03}s both` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 24 }}>{t.icon}</span>
                      <span style={{ fontWeight: 900, fontSize: 15, color: S.text }}>{t.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setEditingType({ ...t })} style={{ background: S.bg, border: "none", borderRadius: 6, padding: 5, cursor: "pointer", color: S.textMuted }}><Icon name="edit" size={13} /></button>
                      <button onClick={() => deleteType(t.id)} style={{ background: S.dangerLight, border: "none", borderRadius: 6, padding: 5, cursor: "pointer", color: S.danger }}><Icon name="trash" size={13} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, marginBottom: 3 }}>ユーザー向け</div>
                  <div style={{ fontSize: 12, color: S.text, lineHeight: 1.6, whiteSpace: "pre-line", maxHeight: 60, overflow: "hidden", marginBottom: 8 }}>{t.userDescription}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, marginBottom: 3 }}>管理者向け</div>
                  <div style={{ fontSize: 12, color: S.text, lineHeight: 1.6, whiteSpace: "pre-line", maxHeight: 60, overflow: "hidden" }}>{t.adminDescription}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====== フォーム管理タブ ====== */}
        {adminTab === "forms" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: S.text }}>フォーム管理</h2>
                <p style={{ fontSize: 13, color: S.textMuted, marginTop: 4 }}>{forms.length}件のフォーム</p>
              </div>
              <button onClick={addForm} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: S.radiusSm, border: "none", background: S.accent, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: S.font }}>
                <Icon name="plus" size={16} /> フォームを追加
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {visibleForms.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: S.textMuted }}>表示できるフォームがありません</div>
              ) : visibleForms.map((f, i) => {
                const fTypes = f.typeIds.map((tid) => types.find((t) => t.id === tid)).filter(Boolean);
                const resCount = responses.filter((r) => r.formId === f.id).length;
                return (
                  <div key={f.id} className="card-hover" style={{ background: S.card, borderRadius: S.radius, padding: "24px", boxShadow: S.shadow, border: `1px solid ${S.border}`, animation: `fadeUp 0.4s ease-out ${i * 0.05}s both` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 18, color: S.text, marginBottom: 4 }}>{f.name}</div>
                        <div style={{ fontSize: 13, color: S.textMuted }}>{f.description}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setEditingForm({ ...f })} style={{ background: S.bg, border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: S.textMuted }}><Icon name="edit" size={15} /></button>
                        <button onClick={() => deleteForm(f.id)} style={{ background: S.dangerLight, border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: S.danger }}><Icon name="trash" size={15} /></button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
                      <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, background: S.accentLight, color: S.accent, fontWeight: 600 }}>📝 {f.questionIds.length}問</span>
                      <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, background: "#EEF2FF", color: "#5B8DB8", fontWeight: 600 }}>📊 回答{resCount}件</span>
                      {fTypes.map((t) => (
                        <span key={t.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: t.color + "14", color: t.color, fontWeight: 500 }}>{t.icon} {t.name}</span>
                      ))}
                      {f.creatorName && (
                        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#FFF3E0", color: "#E65100", fontWeight: 700 }}> 作成者: {f.creatorName}</span>
                      )}
                    </div>

                    {/* 結果表示トグル */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 0", borderTop: `1px solid ${S.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon name={f.showResultToRespondent ? "eye" : "eyeOff"} size={16} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>○○タイプの結果表示</span>
                        </div>
                        <Toggle on={f.showResultToRespondent} onToggle={() => toggleShowResult(f.id)} label={f.showResultToRespondent ? "ON" : "OFF"} />
                      </div>
                      
                      {f.showResultToRespondent && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 24 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: S.textMuted }}>↳ スコア内訳（%）の表示</span>
                          </div>
                          <Toggle on={f.showScoreDetails ?? true} onToggle={() => toggleShowScoreDetails(f.id)} label={(f.showScoreDetails ?? true) ? "ON" : "OFF"} />
                        </div>
                      )}
                    </div>

                    {/* 回答者用URL */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: `1px solid ${S.border}` }}>
                      <Icon name="link" size={14} />
                      <span style={{ fontSize: 12, color: S.textMuted, fontWeight: 500 }}>回答URL:</span>
                      <code style={{ fontSize: 11, color: S.accent, background: S.accentLight, padding: "3px 8px", borderRadius: 4, wordBreak: "break-all" }}>
                        {window.location.origin + window.location.pathname + "#/" + (f.slug || f.id)}
                      </code>
                      <button onClick={() => { navigator.clipboard.writeText(window.location.origin + window.location.pathname + "#/" + (f.slug || f.id)); showToast("URLをコピーしました"); }}
                        style={{ background: S.bg, border: "none", borderRadius: 6, padding: 5, cursor: "pointer", color: S.textMuted, flexShrink: 0 }}><Icon name="copy" size={13} /></button>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                      <button onClick={() => startDiagnosis(f.id)}
                        style={{ background: S.accent, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: S.font, flexShrink: 0 }}>
                        プレビュー
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ====== 設定タブ ====== */}
        {adminTab === "settings" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: S.text, marginBottom: 20 }}>設定</h2>

            {/* 全フォーム表示設定 */}
            <div style={{ background: S.card, borderRadius: S.radius, padding: "24px", boxShadow: S.shadow, border: `1px solid ${S.border}`, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: S.text, marginBottom: 16 }}>フォーム別 結果表示設定</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {forms.map((f) => (
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: S.radiusSm, background: S.bg }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{f.name}</div>
                      <div style={{ fontSize: 12, color: S.textMuted }}>{f.questionIds.length}問・{f.typeIds.length}タイプ</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                      <Toggle on={f.showResultToRespondent} onToggle={() => toggleShowResult(f.id)} label={f.showResultToRespondent ? "全体結果を表示" : "全体結果を非表示"} />
                      {f.showResultToRespondent && (
                        <Toggle on={f.showScoreDetails ?? true} onToggle={() => toggleShowScoreDetails(f.id)} label={(f.showScoreDetails ?? true) ? "内訳を表示" : "内訳を非表示"} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* パスワード変更 */}
            <div style={{ background: S.card, borderRadius: S.radius, padding: "24px", boxShadow: S.shadow, border: `1px solid ${S.border}` }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: S.text, marginBottom: 16 }}>管理者パスワード変更</h3>
              <div style={{ maxWidth: 360 }}>
                <div style={{ marginBottom: 12 }}>
                  <Label>現在のパスワード</Label>
                  <div style={{ padding: "8px 14px", borderRadius: S.radiusSm, background: S.bg, fontSize: 14, color: S.textMuted, fontFamily: "monospace" }}>{"•".repeat(adminPassword.length)}</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Label>新しいパスワード</Label>
                  <Input type="password" value={newPasswordInput} onChange={setNewPasswordInput} placeholder="新しいパスワードを入力" />
                </div>
                <button onClick={() => {
                  if (newPasswordInput.trim().length >= 4) {
                    setAdminPassword(newPasswordInput.trim());
                    setNewPasswordInput("");
                    setPasswordChangeMsg("パスワードを変更しました");
                    setTimeout(() => setPasswordChangeMsg(""), 3000);
                  } else {
                    setPasswordChangeMsg("4文字以上で入力してください");
                    setTimeout(() => setPasswordChangeMsg(""), 3000);
                  }
                }}
                  style={{ padding: "10px 24px", borderRadius: S.radiusSm, border: "none", background: S.accent, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: S.font }}>
                  パスワードを変更
                </button>
                {passwordChangeMsg && (
                  <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: passwordChangeMsg.includes("変更しました") ? "#43A047" : S.danger }}>{passwordChangeMsg}</div>
                )}
              </div>
            </div>

            {/* 作成者用パスワード */}
            <div style={{ background: S.card, borderRadius: S.radius, padding: "24px", boxShadow: S.shadow, border: `1px solid ${S.border}` }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: S.text, marginBottom: 12 }}>フォーム作成者用共通パスワードの変更</h3>
              <p style={{ fontSize: 13, color: S.textMuted, marginBottom: 16 }}>作成者がログインして自分のフォームを作成・編集するときに使う共通パスワードです。</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                <input
                  type="password" value={newCreatorPasswordInput} onChange={(e) => setNewCreatorPasswordInput(e.target.value)}
                  placeholder="新しい作成者パスワード"
                  style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: S.radiusSm, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: S.font, color: S.text, background: "#FAFAF8" }}
                />
                <button onClick={() => {
                  if (newCreatorPasswordInput.length >= 4) {
                    setCreatorPassword(newCreatorPasswordInput.trim());
                    setNewCreatorPasswordInput("");
                    setCreatorPasswordChangeMsg("作成者パスワードを変更しました");
                    setTimeout(() => setCreatorPasswordChangeMsg(""), 3000);
                  } else {
                    setCreatorPasswordChangeMsg("4文字以上で入力してください");
                    setTimeout(() => setCreatorPasswordChangeMsg(""), 3000);
                  }
                }}
                  style={{ padding: "10px 24px", borderRadius: S.radiusSm, border: "none", background: S.accent, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: S.font }}>
                  パスワードを変更
                </button>
                {creatorPasswordChangeMsg && (
                  <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: creatorPasswordChangeMsg.includes("変更しました") ? "#43A047" : S.danger, width: "100%" }}>{creatorPasswordChangeMsg}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ====== 質問編集モーダル ====== */}
      {editingQuestion && (
        <Modal title={editingQuestion.isNew ? "質問を追加" : "質問を編集"} onClose={() => setEditingQuestion(null)} onSave={saveQuestion}>
          <div style={{ marginBottom: 16 }}>
            <Label>質問文</Label>
            <Input value={editingQuestion.text} onChange={(v) => setEditingQuestion((p) => ({ ...p, text: v }))} placeholder="例：休日、急に予定が空いたら？" />
          </div>
          <Label>選択肢とスコア</Label>
          {editingQuestion.choices.map((c, i) => (
            <div key={c.id} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: S.accent, width: 18, textAlign: "center" }}>{["A", "B", "C", "D", "E", "F"][i]}</span>
              <input value={c.label} onChange={(e) => { const nc = [...editingQuestion.choices]; nc[i] = { ...nc[i], label: e.target.value }; setEditingQuestion((p) => ({ ...p, choices: nc })); }} placeholder="選択肢"
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: S.font, color: S.text, background: "#FAFAF8" }} />
              <select value={c.typeId} onChange={(e) => { const nc = [...editingQuestion.choices]; nc[i] = { ...nc[i], typeId: e.target.value }; setEditingQuestion((p) => ({ ...p, choices: nc })); }}
                style={{ padding: "8px 8px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 12, fontFamily: S.font, color: S.text, background: "#FAFAF8", maxWidth: 150 }}>
                <option value="">タイプ</option>
                {types.map((t) => (<option key={t.id} value={t.id}>{t.icon} {t.name}</option>))}
              </select>
              <input type="number" value={c.score} onChange={(e) => { const nc = [...editingQuestion.choices]; nc[i] = { ...nc[i], score: parseInt(e.target.value) || 0 }; setEditingQuestion((p) => ({ ...p, choices: nc })); }}
                style={{ width: 50, padding: "8px 6px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: S.font, textAlign: "center", background: "#FAFAF8" }} min="0" />
              {editingQuestion.choices.length > 2 && (
                <button onClick={() => { const nc = editingQuestion.choices.filter((_, idx) => idx !== i); setEditingQuestion((p) => ({ ...p, choices: nc })); }}
                  style={{ background: S.dangerLight, border: "none", borderRadius: 6, padding: 4, cursor: "pointer", color: S.danger, flexShrink: 0 }}><Icon name="x" size={14} /></button>
              )}
            </div>
          ))}
          {editingQuestion.choices.length < 6 && (
            <button onClick={() => { const newId = editingQuestion.id + "_" + uid(); setEditingQuestion((p) => ({ ...p, choices: [...p.choices, { id: newId, label: "", typeId: types[0]?.id || "", score: 1 }] })); }}
              style={{ fontSize: 12, color: S.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: S.font, marginTop: 4 }}>+ 選択肢を追加</button>
          )}

          {/* インライン新規タイプ作成 */}
          <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: S.radiusSm, background: S.bg, border: `1px dashed ${S.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: S.textMuted, marginBottom: 10 }}>✨ 新しいタイプを追加</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                id="inline-type-name"
                placeholder="タイプ名（例：リーダー型）"
                style={{ flex: 1, minWidth: 140, padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: S.font, color: S.text, background: "#FAFAF8" }}
              />
              <input
                id="inline-type-icon"
                placeholder="🔷"
                style={{ width: 52, padding: "7px 8px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: S.font, textAlign: "center", background: "#FAFAF8" }}
              />
              <input
                id="inline-type-color"
                type="color"
                defaultValue="#888888"
                style={{ width: 42, height: 36, borderRadius: 8, border: `1.5px solid ${S.border}`, cursor: "pointer", padding: 2, background: "#FAFAF8" }}
              />
              <button
                onClick={() => {
                  const nameEl = document.getElementById("inline-type-name");
                  const iconEl = document.getElementById("inline-type-icon");
                  const colorEl = document.getElementById("inline-type-color");
                  const name = nameEl?.value?.trim();
                  if (!name) return;
                  const icon = iconEl?.value?.trim() || "🔷";
                  const color = colorEl?.value || "#888888";
                  const newType = { id: "type_" + uid(), name, icon, color, userDescription: "", adminDescription: "" };
                  setTypes((prev) => [...prev, newType]);
                  showToast(`タイプ「${name}」を追加しました`);
                  if (nameEl) nameEl.value = "";
                  if (iconEl) iconEl.value = "";
                }}
                style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: S.accent, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: S.font, flexShrink: 0 }}
              >追加</button>
            </div>
            <div style={{ fontSize: 11, color: S.textMuted, marginTop: 6 }}>追加後、上の各選択肢のタイプ欄で選択できます</div>
          </div>
        </Modal>
      )}

      {/* ====== タイプ編集モーダル ====== */}
      {editingType && (
        <Modal title={editingType.isNew ? "タイプを追加" : "タイプを編集"} onClose={() => setEditingType(null)} onSave={saveType}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}><Label>タイプ名</Label><Input value={editingType.name} onChange={(v) => setEditingType((p) => ({ ...p, name: v }))} placeholder="例：コミュニケーション重視タイプ" /></div>
            <div style={{ width: 72 }}><Label>アイコン</Label><Input value={editingType.icon} onChange={(v) => setEditingType((p) => ({ ...p, icon: v }))} placeholder="🔷" /></div>
            <div style={{ width: 72 }}><Label>カラー</Label><input type="color" value={editingType.color} onChange={(e) => setEditingType((p) => ({ ...p, color: e.target.value }))} style={{ width: "100%", height: 42, borderRadius: 8, border: `1.5px solid ${S.border}`, cursor: "pointer", padding: 2, background: "#FAFAF8" }} /></div>
          </div>
          <div style={{ marginBottom: 16 }}><Label>ユーザー向け説明文</Label><TextArea value={editingType.userDescription} onChange={(v) => setEditingType((p) => ({ ...p, userDescription: v }))} placeholder="本人に表示する説明" rows={4} /></div>
          <div><Label>人事・管理者向け説明文</Label><TextArea value={editingType.adminDescription} onChange={(v) => setEditingType((p) => ({ ...p, adminDescription: v }))} placeholder="管理者向けの分析情報" rows={4} /></div>
        </Modal>
      )}

      {/* ====== フォーム編集モーダル ====== */}
      {editingForm && (
        <Modal title={editingForm.isNew ? "フォームを追加" : "フォームを編集"} onClose={() => setEditingForm(null)} onSave={saveForm} width={640}>
          <div style={{ marginBottom: 14 }}><Label>フォーム名</Label><Input value={editingForm.name} onChange={(v) => setEditingForm((p) => ({ ...p, name: v }))} placeholder="例：性格診断（社内版）" /></div>
          <div style={{ marginBottom: 14 }}><Label>カスタムURL (英数字で短く設定可)</Label><Input value={editingForm.slug || editingForm.id} onChange={(v) => setEditingForm((p) => ({ ...p, slug: v.replace(/[^a-zA-Z0-9_\-]/g, "") }))} placeholder="例：sale-team" /></div>
          <div style={{ marginBottom: 14 }}><Label>説明文</Label><TextArea value={editingForm.description} onChange={(v) => setEditingForm((p) => ({ ...p, description: v }))} placeholder="フォームの説明" rows={2} /></div>
          <div style={{ marginBottom: 14 }}>
            <Label>結果表示設定</Label>
            <Toggle on={editingForm.showResultToRespondent} onToggle={() => setEditingForm((p) => ({ ...p, showResultToRespondent: !p.showResultToRespondent }))} label={editingForm.showResultToRespondent ? "回答者に結果を表示する" : "回答者に結果を表示しない"} />
          </div>
          {editingForm.showResultToRespondent && (
            <div style={{ marginBottom: 14, paddingLeft: 12, borderLeft: `2px solid ${S.border}` }}>
              <Label>スコア内訳・詳細パーセンテージ表示</Label>
              <Toggle on={editingForm.showScoreDetails ?? true} onToggle={() => setEditingForm((p) => ({ ...p, showScoreDetails: !(p.showScoreDetails ?? true) }))} label={(editingForm.showScoreDetails ?? true) ? "内訳を表示する" : "内訳を表示しない"} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <Label>使用するタイプ</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {types.map((t) => {
                const inc = editingForm.typeIds.includes(t.id);
                return (
                  <button key={t.id} onClick={() => setEditingForm((p) => ({ ...p, typeIds: inc ? p.typeIds.filter((id) => id !== t.id) : [...p.typeIds, t.id] }))}
                    style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: S.font, cursor: "pointer", border: `1.5px solid ${inc ? t.color : S.border}`, background: inc ? t.color + "18" : S.bg, color: inc ? t.color : S.textMuted, transition: "all 0.2s" }}>
                    {t.icon} {t.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>使用する質問（選択順で出題）</Label>
            <div style={{ maxHeight: 300, overflow: "auto", border: `1px solid ${S.border}`, borderRadius: S.radiusSm }}>
              {questions.map((q) => {
                const idx = editingForm.questionIds.indexOf(q.id);
                const inc = idx !== -1;
                return (
                  <div key={q.id} onClick={() => setEditingForm((p) => ({ ...p, questionIds: inc ? p.questionIds.filter((id) => id !== q.id) : [...p.questionIds, q.id] }))}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${S.border}`, background: inc ? S.accentLight : "transparent", transition: "all 0.15s" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${inc ? S.accent : S.border}`, background: inc ? S.accent : "transparent", color: "#fff", transition: "all 0.2s" }}>
                      {inc && <Icon name="check" size={12} />}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: S.text }}>{q.text}</span>
                    {inc && <span style={{ fontSize: 11, fontWeight: 700, color: S.accent, background: S.card, padding: "1px 7px", borderRadius: 4 }}>#{idx + 1}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ====== 回答詳細モーダル ====== */}
      {viewingResponse && (
        <Modal title="回答詳細" onClose={() => setViewingResponse(null)} width={640}>
          {(() => {
            const r = viewingResponse;
            const t = types.find((tp) => tp.id === r.resultTypeId);
            const labelEntries = Object.entries(r.answerLabels);
            return (
              <div>
                {/* 削除ボタン */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button onClick={() => deleteResponse(r.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: S.radiusSm, border: `1.5px solid ${S.danger}`, background: S.dangerLight, cursor: "pointer", fontSize: 12, fontWeight: 600, color: S.danger, fontFamily: S.font }}>
                    <Icon name="trash" size={14} /> この回答を削除
                  </button>
                </div>
                {/* 回答者情報 */}
                <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: "16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 10 }}>回答者情報</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                    <div><span style={{ color: S.textMuted }}>回答日：</span><span style={{ fontWeight: 600, color: S.text }}>{r.respondentInfo.date}</span></div>
                    <div><span style={{ color: S.textMuted }}>所属：</span><span style={{ fontWeight: 600, color: S.text }}>{r.respondentInfo.department || "—"}</span></div>
                    <div><span style={{ color: S.textMuted }}>氏名：</span><span style={{ fontWeight: 600, color: S.text }}>{r.respondentInfo.name}</span></div>
                    <div><span style={{ color: S.textMuted }}>メール：</span><span style={{ fontWeight: 600, color: S.text }}>{r.respondentInfo.email || "—"}</span></div>
                  </div>
                </div>

                {/* 診断結果 */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "14px 16px", borderRadius: S.radiusSm, background: (t?.color || "#888") + "10", border: `1px solid ${(t?.color || "#888") + "30"}` }}>
                  <span style={{ fontSize: 36 }}>{r.resultTypeIcon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: S.textMuted }}>診断結果</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: t?.color || S.text }}>{r.resultTypeLabel}</div>
                  </div>
                </div>

                {/* 個人スコア円グラフ */}
                {(() => {
                  const form = forms.find((f) => f.id === r.formId);
                  if (!form || !r.answerLabels) return null;
                  const scoreCounts = {};
                  Object.values(r.answerLabels).forEach((info) => {
                    if (info.typeLabel) scoreCounts[info.typeLabel] = (scoreCounts[info.typeLabel] || 0) + 1;
                  });
                  const pieData = Object.entries(scoreCounts).map(([tLabel, count]) => {
                    const matchT = types.find((tp) => tp.name === tLabel);
                    return { label: tLabel, icon: matchT?.icon || "", value: count, color: matchT?.color || "#888" };
                  }).sort((a, b) => b.value - a.value);
                  const total = pieData.reduce((s, d) => s + d.value, 0);
                  if (!pieData.length) return null;
                  return (
                    <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: "16px", marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 12 }}>スコア内訳（円グラフ）</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                        <PieChart data={pieData} size={150} />
                        <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 8 }}>
                          {pieData.map((d) => (
                            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: S.text, flex: 1 }}>{d.icon} {d.label}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 50, height: 5, borderRadius: 3, background: "#E5DFD8", overflow: "hidden" }}>
                                  <div style={{ height: "100%", borderRadius: 3, background: d.color, width: `${(d.value / total) * 100}%` }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 900, color: d.color, minWidth: 16 }}>{d.value}</span>
                                <span style={{ fontSize: 11, color: S.textMuted }}>({Math.round((d.value / total) * 100)}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 回答内訳テーブル */}
                <div style={{ fontSize: 13, fontWeight: 700, color: S.textMuted, marginBottom: 8 }}>回答内訳</div>
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${S.border}`, background: "#FAFAF8" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: S.textMuted, whiteSpace: "nowrap" }}>Q</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: S.textMuted }}>質問</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: S.textMuted }}>回答</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: S.textMuted, whiteSpace: "nowrap" }}>タイプ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labelEntries.map(([qId, info], idx) => {
                        const matchType = types.find((tp) => tp.name === info.typeLabel);
                        return (
                          <tr key={qId} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: "8px 10px", fontWeight: 700, color: S.accent }}>{idx + 1}</td>
                            <td style={{ padding: "8px 10px", color: S.text }}>{info.questionText}</td>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: S.text }}>{info.choiceLabel}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 4, background: (matchType?.color || "#888") + "14", color: matchType?.color || "#888", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>{info.typeLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 管理者向けタイプ説明 */}
                {t && (
                  <div style={{ background: "#FFF8F0", borderRadius: S.radiusSm, padding: "16px", border: `1px solid ${t.color}20` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.color, marginBottom: 6 }}>📋 管理者向けタイプ分析</div>
                    <div style={{ fontSize: 13, lineHeight: 1.8, color: S.text, whiteSpace: "pre-line" }}>{t.adminDescription}</div>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* トースト */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#2D2A26", color: "#fff", padding: "12px 24px", borderRadius: S.radiusSm, fontSize: 13, fontWeight: 600, fontFamily: S.font, boxShadow: S.shadowLg, animation: "toastIn 0.3s ease-out", zIndex: 200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
