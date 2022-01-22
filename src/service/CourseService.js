import { Conversion } from "../model/Conversion";
import {Course} from "../model/Course";

export class CourseService {

    constructor() {
        this.localDB = window.localStorage;
    }

    saveCourse(course) {
        let existingCourses = JSON.parse(this.localDB.getItem('courses'));  
        existingCourses.push(course); 
        this.localDB.setItem('courses', JSON.stringify(existingCourses));
    }

    getCourses(){
        return JSON.parse(this.localDB.getItem('courses'));
    }

}
