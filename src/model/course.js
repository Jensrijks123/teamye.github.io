import {v4 as uuidv4} from 'uuid';

export class Course{

    constructor(education,code,name,period,ecCourse,exams) {
        this.id = uuidv4(); // used to generate a unieke identifier
        this.education=education;
        this.code=code;
        this.name=name;
        this.period=period;
        this.ecCourse=ecCourse;
        this.exams=exams;
    }


}
