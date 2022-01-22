import {v4 as uuidv4} from 'uuid';

export class Conversion {

    constructor(bezemOrConversion, oldCourse, newCourse, comment, sheet) {
        this.id = uuidv4(); // used to generate a unieke identifier
        this.bezemOrConversion = bezemOrConversion;
        this.oldCourse=oldCourse;
        this.newCourse=newCourse;
        this.comment=comment;
        this.sheet =sheet;
    }
}
