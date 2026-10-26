import {describe,expect,it} from "@rbxts/jest-globals";
import {DOCUMENT_COLUMNS,DOCUMENT_LINES,chaptersWithEvidence,documentFor,documentLine} from "../shared/StoryDocuments";
import {STORY} from "../shared/RelayStory";

// Only toBe/toBeUndefined: this spec also runs in the offline Luau harness.
describe("evidence documents",()=>{
	it("gives every chapter with an evidence shot a document; chapter 4's roster is the one extra, on the chart behind the radio",()=>{
		const withEvidence=new Set(chaptersWithEvidence());
		expect(withEvidence.size()>=15).toBe(true);
		for(const chapter of STORY){
			const doc=documentFor(chapter.id);
			if(withEvidence.has(chapter.id) || chapter.id===4)expect(doc!==undefined && doc.size()>0).toBe(true);
			else expect(doc).toBeUndefined();
		}
		expect(withEvidence.has(4)).toBe(false);
		expect(documentFor(99)).toBeUndefined();
	});
	it("keeps every document to six ASCII lines of at most 28 characters",()=>{
		for(const chapter of STORY){
			const doc=documentFor(chapter.id);
			if(!doc)continue;
			expect(doc.size()<=DOCUMENT_LINES).toBe(true);
			for(const raw of doc){
				expect(raw.size()>0 && raw.size()<=DOCUMENT_COLUMNS).toBe(true);
				let ascii=true;
				for(const i of $range(1,raw.size()))if(raw.byte(i)[0]>126 || raw.byte(i)[0]<32)ascii=false;
				expect(ascii).toBe(true);
			}
		}
	});
	it("splits strike and stamp marks off the line text",()=>{
		expect(documentLine("~STATUS: DESERTED").struck).toBe(true);
		expect(documentLine("~STATUS: DESERTED").text).toBe("STATUS: DESERTED");
		expect(documentLine("!KILLED, NOT DESERTED").stamp).toBe(true);
		expect(documentLine("!KILLED, NOT DESERTED").text).toBe("KILLED, NOT DESERTED");
		const plain=documentLine("ORDER 0001");
		expect(plain.struck).toBe(false);expect(plain.stamp).toBe(false);expect(plain.text).toBe("ORDER 0001");
	});
	it("tells the story beats the brief asks for on paper",()=>{
		const struck=(id:number)=>documentFor(id)!.filter((raw)=>documentLine(raw).struck).size();
		const stamped=(id:number)=>documentFor(id)!.filter((raw)=>documentLine(raw).stamp).map((raw)=>documentLine(raw).text);
		expect(struck(4)).toBe(3);
		expect(documentFor(1)![0].find("GRAIN")[0]!==undefined).toBe(true);
		expect(documentFor(9)![0]).toBe("CERTIFICATE OF DEATH");
		expect(documentFor(17)![0]).toBe("ORDER 0001");expect(stamped(17)[0]).toBe("SIGNED: RUSK, AIR MARSHAL");
		expect(struck(25)).toBe(1);expect(stamped(25)[0]).toBe("KILLED, NOT DESERTED");
		expect(documentFor(27)![0].find("ROSTER")[0]!==undefined).toBe(true);expect(struck(27)).toBe(1);
	});
});
