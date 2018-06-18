// Application modules
const { Header } = require(`./header`),
    { Answer } = require(`./answer`),
    { Question } = require(`./question`),
    { Warn } = require(`../../logging`);

let _originalMessage = new WeakMap(),
    _generatedMessage = new WeakMap(),
    _header = new WeakMap(),
    _questionList = new WeakMap(),
    _answerList = new WeakMap();

class DNSMessage {
    constructor(messageBuffer) {
        // If a message is passed in, decode it
        if (!!messageBuffer) {
            _originalMessage.set(this, messageBuffer);
            this._decode();
        }
    }

    get header() { return _header.get(this); }
    get questions() { return !!_questionList.get(this) ? _questionList.get(this) : []; }
    get answers() { return !!_answerList.get(this) ? _answerList.get(this) : []; }

    get buffer() {
        // If an original message exists, and it differs from the generated, send the original
        let original = _originalMessage.get(this),
            generated = _generatedMessage.get(this);

        if (!!original && !original.equals(generated)) {
            Warn({ [`Generation Mismatch`]: true, original: original.toString(`hex`), generate: generated.toString(`hex`) });
            return original;
        } else
            return generated;
    }

    _decode() {
        let offset,
            questions = [],
            answers = [];

        _header.set(this, new Header(_originalMessage.get(this)));

        offset = this.header.length;
        for (let idx = 0, total = this.header.numberOfQuestions; idx < total; idx++) {
            let q = new Question(_originalMessage.get(this), offset);
            offset = q.endingOffset;
            questions.push(q);
        }
        if (questions.length > 0)
            _questionList.set(this, questions);

        for (let idx = 0, total = this.header.numberOfAnswers; idx < total; idx++) {
            let a = new Answer(_originalMessage.get(this), offset);
            offset = a.endingOffset;
            answers.push(a);
        }
        if (answers.length > 0)
            _answerList.set(this, answers);

        // Generate a new buffer based on the decoded message
        this.GenerateBuffer();
    }

    ReplyFromCache(dnsQuery, cachedAnswer) {
        let header = new Header();
        header.queryId = dnsQuery.header.queryId;
        _header.set(this, header);

        _questionList.set(this, dnsQuery.questions);

        _answerList.set(this, cachedAnswer);

        this.header.GenerateHeader(this, dnsQuery);

        this.GenerateBuffer();
    }

    GenerateBuffer() {
        _generatedMessage.set(this, Buffer.from(this.toHex(), `hex`));
    }

    toHex() {
        let hexMessage = `${this.header.toHex()}${this.questions.map(q => { return q.toHex(); }).join(``)}`;
        // To enable name compression, each answer needs to know the entire message as it exists to this point
        this.answers.forEach(a => {
            hexMessage += a.toHex(hexMessage);
        });
        return hexMessage;
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
