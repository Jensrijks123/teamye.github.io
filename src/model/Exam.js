import {v4 as uuidv4} from 'uuid';

export class Exam {
    constructor(examType,weighting,ecExam,coordinator) {
        this.id = uuidv4(); // used to generate a unieke identifier
        this.examType=examType;
        this.weighting=weighting;
        this.ecExam=ecExam;
        this.coordinator=coordinator;
    }
}
