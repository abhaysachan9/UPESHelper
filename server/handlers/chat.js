/**
 * server/handlers/chat.js
 * POST /api/chat — Receives a user question, retrieves context from
 * Upstash Vector via RAG, and returns a Gemini-generated answer.
 */

import { retrieveContext } from '../services/vectorDb.js';
import { generateAnswer } from '../services/gemini.js';
import { readBody } from '../utils/http.js';

export async function handleChat(req, res) {
    // 1. Parse request body
    let body;
    try {
        body = await readBody(req);
    } catch {
        return badRequest(res, 'Invalid request body');
    }

    const { message, language } = body;
    if (!message || typeof message !== 'string' || !message.trim()) {
        return badRequest(res, '"message" field is required');
    }

    const question = message.trim();
    const userLanguage = language || 'en-IN';
    console.log(`\n💬 User: ${question} [${userLanguage}]`);

    try {
        // 2. Retrieve relevant context from vector DB
        const contextChunks = await retrieveContext(question);

        if (!contextChunks || contextChunks.length === 0) {
            // Language-specific fallback messages
            const noContextMessages = {
                'en-IN': "I'm sorry, I couldn't find relevant information in the knowledge base for your question. Please try rephrasing or ask about topics like fees, admission, courses, hostel, scholarships, or campus services.",
                'hi-IN': "क्षमा करें, मुझे आपके प्रश्न के लिए ज्ञान आधार में प्रासंगिक जानकारी नहीं मिली। कृपया पुनः शब्दों में पूछें या फीस, प्रवेश, पाठ्यक्रम, छात्रावास, छात्रवृत्ति या परिसर सेवाओं के बारे में पूछें।",
                'es-ES': "Lo siento, no pude encontrar información relevante en la base de conocimientos para tu pregunta. Por favor, reformula o pregunta sobre temas como tarifas, admisión, cursos, alojamiento, becas o servicios del campus.",
                'fr-FR': "Désolé, je n'ai pas trouvé d'informations pertinentes dans la base de connaissances pour votre question. Veuillez reformuler ou poser des questions sur les frais, l'admission, les cours, le logement, les bourses ou les services du campus.",
                'de-DE': "Es tut mir leid, ich konnte keine relevanten Informationen in der Wissensdatenbank für Ihre Frage finden. Bitte formulieren Sie neu oder fragen Sie nach Themen wie Gebühren, Zulassung, Kurse, Unterkunft, Stipendien oder Campus-Services.",
                'zh-CN': "抱歉，我在知识库中找不到与您的问题相关的信息。请重新表述或询问有关费用、入学、课程、宿舍、奖学金或校园服务的主题。",
                'ja-JP': "申し訳ございませんが、ご質問に関連する情報が知識ベースに見つかりませんでした。言い換えるか、料金、入学、コース、寮、奨学金、キャンパスサービスなどのトピックについてお尋ねください。",
                'ar-SA': "عذراً، لم أتمكن من العثور على معلومات ذات صلة في قاعدة المعرفة لسؤالك. يرجى إعادة الصياغة أو السؤال عن مواضيع مثل الرسوم والقبول والدورات والسكن والمنح الدراسية أو خدمات الحرم الجامعي.",
                'pt-BR': "Desculpe, não consegui encontrar informações relevantes na base de conhecimento para sua pergunta. Por favor, reformule ou pergunte sobre tópicos como taxas, admissão, cursos, alojamento, bolsas de estudo ou serviços do campus.",
                'ru-RU': "Извините, я не смог найти соответствующую информацию в базе знаний для вашего вопроса. Пожалуйста, переформулируйте или спросите о таких темах, как плата, прием, курсы, общежитие, стипендии или услуги кампуса.",
                'ko-KR': "죄송합니다. 질문에 대한 관련 정보를 지식 베이스에서 찾을 수 없습니다. 다시 표현하거나 등록금, 입학, 과정, 기숙사, 장학금 또는 캠퍼스 서비스에 대해 질문해 주세요.",
                'it-IT': "Mi dispiace, non ho trovato informazioni pertinenti nella base di conoscenza per la tua domanda. Per favore, riformula o chiedi informazioni su tasse, ammissione, corsi, alloggio, borse di studio o servizi del campus.",
                'nl-NL': "Sorry, ik kon geen relevante informatie vinden in de kennisbank voor uw vraag. Probeer het opnieuw te formuleren of vraag naar onderwerpen zoals collegegeld, toelating, cursussen, huisvesting, beurzen of campusdiensten.",
                'tr-TR': "Üzgünüm, sorunuz için bilgi tabanında ilgili bilgi bulamadım. Lütfen yeniden ifade edin veya ücretler, kabul, kurslar, yurt, burslar veya kampüs hizmetleri hakkında sorun.",
                'vi-VN': "Xin lỗi, tôi không tìm thấy thông tin liên quan trong cơ sở kiến thức cho câu hỏi của bạn. Vui lòng thử diễn đạt lại hoặc hỏi về các chủ đề như học phí, tuyển sinh, khóa học, ký túc xá, học bổng hoặc dịch vụ khuôn viên.",
                'th-TH': "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในฐานความรู้สำหรับคำถามของคุณ กรุณาลองถามใหม่หรือสอบถามเกี่ยวกับค่าธรรมเนียม การรับสมัคร หลักสูตร หอพัก ทุนการศึกษา หรือบริการในมหาวิทยาลัย",
                'bn-IN': "দুঃখিত, আপনার প্রশ্নের জন্য জ্ঞান ভাণ্ডারে প্রাসঙ্গিক তথ্য পাওয়া যায়নি। অনুগ্রহ করে পুনরায় বলুন বা ফি, ভর্তি, কোর্স, হোস্টেল, বৃত্তি বা ক্যাম্পাস পরিষেবা সম্পর্কে জিজ্ঞাসা করুন।",
                'ta-IN': "மன்னிக்கவும், உங்கள் கேள்விக்கான தொடர்புடைய தகவலை அறிவுத் தளத்தில் கண்டறிய முடியவில்லை. மறுவடிவமாகக் கேளுங்கள் அல்லது கட்டணம், சேர்க்கை, படிப்புகள், விடுதி, உதவித்தொகை அல்லது வளாக சேவைகள் பற்றி கேளுங்கள்.",
                'te-IN': "క్షమించండి, మీ ప్రశ్నకు సంబంధించిన సమాచారం జ్ఞాన భాండాగారంలో కనుగొనబడలేదు. దయచేసి మళ్ళీ అడగండి లేదా ఫీజులు, అడ్మిషన్, కోర్సులు, హాస్టల్, స్కాలర్‌షిప్‌లు లేదా క్యాంపస్ సేవల గురించి అడగండి.",
                'mr-IN': "क्षमस्व, तुमच्या प्रश्नासाठी ज्ञान आधारात संबंधित माहिती सापडली नाही. कृपया पुन्हा विचारा किंवा शुल्क, प्रवेश, अभ्यासक्रम, वसतिगृह, शिष्यवृत्ती किंवा कॅम्पस सेवांबद्दल विचारा.",
            };
            
            const noContextAnswer = {
                answer: noContextMessages[userLanguage] || noContextMessages['en-IN'],
                sources: [],
            };
            return jsonResponse(res, 200, noContextAnswer);
        }

        // 3. Generate answer using Gemini with retrieved context
        const answer = await generateAnswer(question, contextChunks, userLanguage);
        const seenUrls = new Set();
        const sources = contextChunks
            .filter(c => c.metadata?.url && !seenUrls.has(c.metadata.url) && seenUrls.add(c.metadata.url))
            .map(c => ({ url: c.metadata.url, title: c.metadata.title || '' }));

        console.log(`✅ Answer generated (${contextChunks.length} context chunks)`);

        return jsonResponse(res, 200, { answer, sources });
    } catch (err) {
        console.error('Chat handler error:', err);
        return jsonResponse(res, 500, { error: 'Failed to generate a response. Please try again.' });
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function badRequest(res, message) {
    return jsonResponse(res, 400, { error: message });
}

function jsonResponse(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
}
