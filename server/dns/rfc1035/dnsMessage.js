// Application modules
const { Answer } = require(`./answer`),
    { Header } = require(`./header`),
    { Question } = require(`./question`);

let _bufferMessage = new WeakMap(),
    _header = new WeakMap(),
    _questionList = new WeakMap(),
    _answerList = new WeakMap();

class DNSMessage {
    constructor() {}

    get answers() { return _answerList.get(this); }
    set answers(val) { _answerList.set(this, val); }

    get header() { return _header.get(this); }
    set header(val) { _header.set(this, val); }

    get questions() { return _questionList.get(this); }
    set questions(val) { _questionList.set(this, val); }

    Decode(messageBuffer) {
        _bufferMessage.set(this, messageBuffer);

        let offset;

        this.header = new Header();
        offset = this.header.Decode(messageBuffer, offset);

        let questions = [];
        for (let idx = 0, total = this.header.numberOfQuestions; idx < total; idx++) {
            let q = new Question();
            offset = q.Decode(messageBuffer, offset);
            questions.push(q);
        }
        this.questions = questions;

        let answers = [];
        for (let idx = 0, total = this.header.numberOfAnswers; idx < total; idx++) {
            let a = new Answer();
            offset = a.Decode(messageBuffer, offset);
            answers.push(a);
        }
        this.answers = answers;
    }

    toJSON() {
        return {
            header: this.header,
            questions: this.questions,
            answers: this.answers,
        };
    }
}

module.exports.DNSMessage = DNSMessage;
