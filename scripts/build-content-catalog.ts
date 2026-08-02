import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentPackSchema } from '../src/content/schema.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = resolve(root, 'public/content');
const releasedAt = '2026-08-02T00:00:00.000Z';
const hotelTopics = [
  ['找不到订单', 'Unable to Locate a Booking'],
  ['索要酒店确认号', 'Requesting Hotel Confirmation Number'],
  ['深夜抵达避免 no-show', 'Late Arrival and No-show Prevention'],
  ['修改入住人姓名', 'Changing Guest Name'],
  ['修改入住日期', 'Changing Stay Dates'],
  ['确认房型床型偏好', 'Confirming Room, Bed and Smoking Preference'],
  ['早餐税费和城市税', 'Breakfast, Taxes and City Tax'],
  ['付款担保和预授权', 'Payment, Guarantee and Pre-authorisation'],
  ['超售和替代住宿', 'Overbooking and Alternative Accommodation'],
  ['提前入住和延迟退房', 'Early Check-in and Late Check-out'],
  ['取消和退款进度', 'Cancellation and Refund Status'],
  ['房间问题投诉升级', 'Room Issue, Complaint and Escalation']
] as const;
const flightTopics = [
  ['确认出票状态和票号', 'Ticketing Status and Ticket Number'],
  ['航班时刻变更', 'Schedule Change'],
  ['航班取消和重新安排', 'Cancellation and Rebooking'],
  ['改签费用和新行程', 'Change Fee and New Itinerary'],
  ['退票和退款进度', 'Refund Status'],
  ['票价规则', 'Fare Rules'],
  ['姓名更正', 'Name Correction'],
  ['护照信息更新', 'Passport Information Update'],
  ['行李额度和超额行李', 'Baggage Allowance and Excess Baggage'],
  ['座位餐食和特殊服务', 'Seat, Meal and Special Service'],
  ['中转衔接和误机', 'Connection and Missed Flight'],
  ['出票时限和订单异常', 'Ticketing Time Limit and Booking Status']
] as const;

function makeScenario(
  category: 'hotel' | 'flight',
  channel: 'email' | 'chat',
  index: number,
  topic: readonly [string, string]
) {
  const base =
    category === 'hotel'
      ? {
          entity: '[BOOKING_ID]',
          ref: '[HOTEL_CONFIRMATION]',
          partner: 'hotel reservations team',
          action: 'check the reservation and confirm the current status'
        }
      : {
          entity: '[BOOKING_ID]',
          ref: '[TICKET_NUMBER]',
          partner: 'airline support team',
          action: 'check the booking and provide the current itinerary'
        };
  const id = `${category}-${channel}-${String(index + 1).padStart(2, '0')}`;
  const request = `Could you please ${base.action} for ${base.entity}?`;
  const body = `Dear ${base.partner},\n\n${request} The traveller reference is ${base.ref}. Please let us know if any action or additional information is required.\n\nThank you for your assistance.\nBest regards,\nOperations Team`;
  return {
    id,
    version: '1.0.0',
    titleZh: topic[0],
    titleEn: topic[1],
    category,
    channel,
    difficulty: index < 4 ? 'beginner' : index < 9 ? 'intermediate' : 'advanced',
    duration: channel === 'email' ? 8 : 5,
    context: `你是中文运营人员，需与${category === 'hotel' ? '海外酒店' : '航空公司'}核实「${topic[0]}」，避免作出未经确认的承诺。`,
    userRole: 'Operations coordinator',
    partnerRole: base.partner,
    partnerMessage: `Hello, we need more details before we can assist with ${topic[1].toLowerCase()}.`,
    translation: `您好，我们需要更多信息才能协助处理${topic[0]}。`,
    requiredObjectives: [
      {
        id: 'request',
        label: '礼貌说明请求',
        keywords: ['could you', 'please', 'would you'],
        required: true
      },
      {
        id: 'identify',
        label: '提供订单识别信息',
        keywords: ['booking', 'reference', '[booking_id]', base.ref.toLowerCase()],
        required: true
      },
      {
        id: 'confirm',
        label: '请求书面确认或状态',
        keywords: ['confirm', 'status', 'let us know'],
        required: true
      }
    ],
    optionalObjectives: [
      { id: 'thanks', label: '表达感谢', keywords: ['thank', 'appreciate'], required: false }
    ],
    requiredEntities: ['bookingId'],
    keywords: {
      confirm: ['confirm', 'verify', 'check'],
      request: ['could you', 'would you', 'please'],
      urgent: ['urgent', 'as soon as possible']
    },
    nodes: [
      {
        id: 'n1',
        speaker: 'partner',
        text: `Please share the booking reference for ${topic[1].toLowerCase()}.`,
        next: ['n2', 'n3']
      },
      {
        id: 'n2',
        speaker: 'user',
        text: request,
        expectedIntent: 'request confirmation',
        next: ['n4']
      },
      {
        id: 'n3',
        speaker: 'user',
        text: 'Could you clarify which reference you require?',
        expectedIntent: 'request clarification',
        next: ['n4']
      },
      {
        id: 'n4',
        speaker: 'partner',
        text: 'We are checking the record now. Is there anything else to confirm?',
        next: ['n5', 'n6']
      },
      {
        id: 'n5',
        speaker: 'user',
        text: `Please also confirm ${base.ref} in writing.`,
        expectedIntent: 'request written confirmation',
        next: ['n7']
      },
      {
        id: 'n6',
        speaker: 'user',
        text: 'Thank you. Please let us know once it is confirmed.',
        expectedIntent: 'request confirmation',
        next: ['n7']
      },
      {
        id: 'n7',
        speaker: 'partner',
        text: 'The request is recorded; we will update you shortly.',
        next: ['n8']
      },
      {
        id: 'n8',
        speaker: 'user',
        text: 'Thank you for your assistance.',
        expectedIntent: 'thanks',
        next: []
      }
    ],
    hints: [
      '先礼貌说明要处理的事项。',
      `用 ${base.entity} 或订单号让对方可以定位记录。`,
      '明确要求确认状态或后续步骤。'
    ],
    vocabulary: [
      { term: 'reservation', meaning: '预订（酒店）' },
      { term: 'itinerary', meaning: '行程（航班）' },
      { term: 'confirm', meaning: '确认' }
    ],
    phrases: [
      { text: request, meaning: '请协助核实该订单。' },
      {
        text: 'Please let us know if any action is required.',
        meaning: '如需我们采取任何操作，请告知。'
      }
    ],
    commonErrors: [
      '避免使用 reply me，应使用 reply to us 或 let us know。',
      '不要承诺退款或补偿一定会成功。'
    ],
    reference:
      channel === 'email'
        ? { subject: `${topic[1]} — ${base.entity}`, body }
        : {
            body: request,
            dialogue: [
              {
                role: 'partner',
                text: `Please share the booking reference for ${topic[1].toLowerCase()}.`
              },
              { role: 'user', text: `${request} The reference is ${base.entity}.` },
              { role: 'partner', text: 'We are checking it now.' },
              { role: 'user', text: 'Thank you. Please send written confirmation when available.' }
            ]
          },
    scoring: {
      politenessTerms: ['please', 'could you', 'would you', 'thank you'],
      minWords: channel === 'email' ? 24 : 8,
      maxChatWords: 80
    }
  };
}
function pack(
  category: 'hotel' | 'flight',
  channel: 'email' | 'chat',
  topics: readonly (readonly [string, string])[]
) {
  return {
    id: `${category}-${channel}-core`,
    version: '1.0.0',
    minAppVersion: '1.0.0',
    releasedAt,
    scenarios: topics.map((t, i) => makeScenario(category, channel, i, t))
  };
}
const packs = [
  pack('hotel', 'email', hotelTopics),
  pack('hotel', 'chat', hotelTopics),
  pack('flight', 'email', flightTopics),
  pack('flight', 'chat', flightTopics)
];
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const checkOnly = process.argv.includes('--check');
await mkdir(resolve(contentDir, 'packs'), { recursive: true });
const catalog = { catalogVersion: 1, releasedAt, packs: [] as Array<Record<string, unknown>> };
for (const item of packs) {
  const parsed = contentPackSchema.parse(item);
  const ids = new Set(parsed.scenarios.map((s) => s.id));
  if (ids.size !== parsed.scenarios.length)
    throw new Error(`Duplicate scenario ID in ${parsed.id}`);
  const filename = `${parsed.id}-${parsed.version}.json`;
  const serialized = `${JSON.stringify(parsed, null, 2)}\n`;
  const target = resolve(contentDir, 'packs', filename);
  if (checkOnly) {
    const existing = await readFile(target, 'utf8');
    if (existing !== serialized) throw new Error(`${filename} is stale; run npm run build:catalog`);
  } else await writeFile(target, serialized);
  catalog.packs.push({
    id: parsed.id,
    version: parsed.version,
    minAppVersion: parsed.minAppVersion,
    path: `./packs/${filename}`,
    sha256: digest(serialized),
    scenarioCount: parsed.scenarios.length,
    releasedAt,
    changelog: [
      `内置首批${parsed.id.includes('hotel') ? '酒店' : '航班'}${parsed.id.includes('email') ? '邮件' : '聊天'}场景`
    ]
  });
}
const catalogText = `${JSON.stringify(catalog, null, 2)}\n`;
if (checkOnly) {
  if ((await readFile(resolve(contentDir, 'catalog.json'), 'utf8')) !== catalogText)
    throw new Error('catalog.json is stale; run npm run build:catalog');
} else await writeFile(resolve(contentDir, 'catalog.json'), catalogText);
console.log(`${checkOnly ? 'Validated' : 'Built'} ${packs.length} packs / 48 scenarios`);
