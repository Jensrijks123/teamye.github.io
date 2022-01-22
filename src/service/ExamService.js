// import {Exam} from "../model/Exam";

export class ExamService {

    constructor() {
        this.localDB = window.localStorage;
    }

    saveExam(exam) {
        let existingExames = JSON.parse(this.localDB.getItem('exams'));
        existingExames.push(exam);
        this.localDB.setItem('exams', JSON.stringify(existingExames));  
    }

    getExamens(){
        return JSON.parse(this.localDB.getItem('exams'));
    }

}
