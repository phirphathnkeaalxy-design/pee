const DEFAULT_PRODUCTS = [
    {
        id: 'jar-1',
        type: 'jar',
        name: 'SOULIN Original Herbal (กระปุก 20g)',
        scent: 'สูตรดั้งเดิม',
        desc: 'สมุนไพรหมักบ่ม 10 ชนิด กลิ่นหอมลึก เย็นสดชื่น คลายความอ่อนล้า ขนาด 20g',
        price: 89,
        stock: 50,
        iconClass: 'fa-jar',
        badgeText: 'กระปุกสมุนไพร 20g',
        img: 'https://cdn.imagetourls.com/uploads/tyImg/kWb97MRJ.jpg'
    },
    {
        id: 'jar-2',
        type: 'jar',
        name: 'SOULIN Fresh Peppermint (กระปุก 20g)',
        scent: 'กลิ่นเปปเปอร์มินท์สด',
        desc: 'ความสดชื่นตื่นตัวจากเปปเปอร์มินท์ธรรมชาติ ปลุกพลังสมองกระจ่างใส ขนาด 20g',
        price: 89,
        stock: 40,
        iconClass: 'fa-jar',
        badgeText: 'กระปุกสมุนไพร 20g',
        img: 'https://cdn.imagetourls.com/uploads/tyImg/1bnCzbMsn.jpg'
    },
    {
        id: 'jar-3',
        type: 'jar',
        name: 'SOULIN Citrus Vitality (กระปุก 20g)',
        scent: 'กลิ่นส้มและส้มโอ',
        desc: 'กลิ่นหอมสดใสผ่อนคลายด้วยอโรมาส้มซิตรัส เติมความชีวาในวันทำงาน ขนาด 20g',
        price: 95,
        stock: 35,
        iconClass: 'fa-jar',
        badgeText: 'กระปุกสมุนไพร 20g',
        img: 'https://cdn.imagetourls.com/uploads/tyImg/1heuOdjNT.jpg'
    },
    {
        id: 'jar-4',
        type: 'jar',
        name: 'SOULIN Deep Sleep Lavender (กระปุก 20g)',
        scent: 'กลิ่นลาเวนเดอร์ผ่อนคลาย',
        desc: 'ความหอมละมุนตระกูลดอกไม้ คลายความเครียด ช่วยให้นอนหลับสบาย ขนาด 20g',
        price: 95,
        stock: 30,
        iconClass: 'fa-jar',
        badgeText: 'กระปุกสมุนไพร 20g',
        img: 'https://cdn.imagetourls.com/uploads/tyImg/zqxQsznY.jpg'
    },
    {
        id: 'stick-1',
        type: 'stick',
        name: 'SOULIN Original Herbal (แท่งลูกกลิ้ง 10 ml)',
        scent: 'สูตรดั้งเดิม',
        desc: 'ยาดมแท่งทรงสลิมพกพาง่าย ขนาด 10 ml พร้อมหัวลูกกลิ้งนวดขมับ สูดสดชื่นได้ทุกที่',
        price: 69,
        stock: 60,
        iconClass: 'fa-capsules',
        badgeText: 'แท่งลูกกลิ้ง 10 ml',
        img: 'https://cdn.imagetourls.com/uploads/tyImg/qLwjLNbX.jpg'
    },
    {
        id: 'stick-2',
        type: 'stick',
        name: 'SOULIN Fresh Peppermint (แท่งลูกกลิ้ง 10 ml)',
        scent: 'กลิ่นเปปเปอร์มินท์สด',
        desc: 'เย็นสุดขั้วในรูปแบบแท่งลูกกลิ้ง 10 ml สูดสะดวก กลิ่นเปปเปอร์มินท์สดชื่นตื่นตัวทันที',
        price: 69,
        stock: 45,
        iconClass: 'fa-capsules',
        badgeText: 'แท่งลูกกลิ้ง 10 ml',
        img: 'https://cdn.imagetourls.com/uploads/tyImg/BRhnXw8s.jpg'
    },
    {
        id: 'stick-3',
        type: 'stick',
        name: 'SOULIN Citrus Vitality (แท่งลูกกลิ้ง 10 ml)',
        scent: 'กลิ่นส้มและส้มโอ',
        desc: 'ลูกกลิ้งเอสเซนเชียลออยล์กลิ่นส้มและส้มโอ ขนาด 10 ml กลิ่นหอมสดใส พกติดกระเป๋าสะดวก',
        price: 75,
        stock: 50,
        iconClass: 'fa-capsules',
        badgeText: 'แท่งลูกกลิ้ง 10 ml',
        img: 'https://cdn.imagetourls.com/uploads/tyImg/jkfoXhaj.jpg'
    },
    {
        id: 'stick-4',
        type: 'stick',
        name: 'SOULIN Deep Sleep Lavender (แท่งลูกกลิ้ง 10 ml)',
        scent: 'กลิ่นลาเวนเดอร์ผ่อนคลาย',
        desc: 'กลิ่นดอกลาเวนเดอร์อ่อนโยน ขนาด 10 ml แต้มขมับหรือข้อมือ ช่วยคลายกังวลและหลับสบาย',
        price: 75,
        stock: 40,
        iconClass: 'fa-capsules',
        badgeText: 'แท่งลูกกลิ้ง 10 ml',
        img: 'https://cdn.imagetourls.com/uploads/tyImg/rdkCFbnq.jpg'
    }
];

const PROMOTIONS = [
    {
        tag: 'โปรโมชั่นต้อนรับเทศกาล',
        badgeBg: 'bg-emerald-100 text-emerald-800',
        title: 'ซื้อครบ 500 ฿ ลดทันที 50 ฿',
        desc: 'ช้อปยาดมสมุนไพร SOULIN สูตรใดก็ได้ครบ 500 บาท รับส่วนลดอัตโนมัติในตะกร้าทันที'
    },
    {
        tag: 'เซ็ตสุดคุ้ม 8 ตะกร้า',
        badgeBg: 'bg-amber-100 text-amber-800',
        title: 'คละสูตรกระปุก & แท่งลูกกลิ้ง',
        desc: 'พกพาสะดวกทุกที่ด้วยแบบแท่งลูกกลิ้ง 10 ml และวางบนโต๊ะทำงานด้วยแบบกระปุก 20g'
    },
    {
        tag: '100% Natural Herbs',
        badgeBg: 'bg-teal-100 text-teal-800',
        title: 'สมุนไพรออร์แกนิกแท้ 100%',
        desc: 'คัดสรรวัตถุดิบสมุนไพรธรรมชาติกว่า 10 ชนิด สูดความสดชื่นลึกไปถึงดวงวิญญาณ'
    }
];

const DEFAULT_PAYMENT_CONFIG = {
    promptpayId: '0812345678',
    promptpayName: 'บจก. โซลอิน เฮอร์เบิล (SOULIN)',
    bankName: 'ธนาคารกสิกรไทย (KBANK)',
    bankAccountNo: '012-3-45678-9',
    bankAccountName: 'บจก. โซลอิน เฮอร์เบิล',
    enablePromptpay: true,
    enableCod: true,
    codFee: 0
};

const DEFAULT_CMS_CONFIG = {
    title: 'สูดความสดชื่น\nลึกถึงดวงวิญญาณ',
    tag: '100% Natural Organic Herbs',
    subtitle: 'สัมผัสความผ่อนคลายกับยาดมสมุนไพรธรรมชาติแท้ SOULIN คัดสรรวัตถุดิบสมุนไพรกว่า 10 ชนิด เพื่อการเยียวยาจิตใจและคืนความสดชื่นในทุกๆ วัน',
    img: 'https://cdn.phototourl.com/anon/2026-11-17-6fd33c34-28bf-4b63-b3ff-7da85f10f787.png',
    gsheetWebhook: '',
    paymentConfig: { ...DEFAULT_PAYMENT_CONFIG }
};

const ORDER_STATUS_OPTIONS = [
    'รอตรวจสอบการชำระเงิน',
    'ชำระเงินเรียบร้อย (รอจัดส่ง)',
    'เก็บเงินปลายทาง (รอจัดส่ง)',
    'กำลังจัดส่ง',
    'จัดส่งสำเร็จ',
    'ยกเลิกคำสั่งซื้อ'
];

function cloneDefaultProducts() {
    if (typeof structuredClone === 'function') {
        return structuredClone(DEFAULT_PRODUCTS);
    }
    return JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
}
