/**
 * Dominosa, domino based puzzle
 * Copyright (C) 2010  Luis M Pena, lu@coderazzi.net
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var board;
var LinkDirection={UP:0, DOWN:1, RIGHT:3, LEFT:4};
var LOCATION_PATTERN = /board_(\d+)_(\d+)/;

/** index in array, required for IE **/
function arrayIndex(array, element){
	if (array.indexOf){
		return array.indexOf(element);
	}
	for(var i=array.length-1; i>=0; i--){
        if(array[i]==element){
            return i;
        }
    }
    return -1;	
}

/**
 * A Domino represents a domino piece, without any fixed location.<br>
 * It contains just two numbers, with the second never bigger than the first<br>
 * The Html page will contain on the right side a list of all the pieces, so 
 * each Domino class has an associate Html element<br>
 * This function is its constructor
 */
function Domino(a, b){
	this.a=a; //first number
	this.b=b; //second number
	this.locations = new Array(); //all associated locations
	
	this.toString = function(){
		return a+"-"+b;
	}
	/**
	 * Method to associate or dissociate an existing location (two locations
	 * in fact) to/from this piece.<br>
	 *  The order of the locations is not important<br>
	 * @param locA is a Cell instance
	 * @param locB is a Cell instance
	 * @param isLinked should be true to associate the locations
	 */
	this.onLocation = function (locA, locB, isLinked){
		var cl = this.getClass();
		if (isLinked){
			this.locations.push(locA);
			this.locations.push(locB);
		} else {
			this.locations.splice(arrayIndex(this.locations, locA), 1);
			this.locations.splice(arrayIndex(this.locations, locB), 1);
		}
		var ok = this.locations.length<=2;
		for (var i in this.locations){
			this.locations[i].setDominoOk(ok);
		}
		var ncl = this.getClass();
		if (ncl!=cl){
			this.getHtmlElement().className=ncl;	
		}
	}
	/**
	 * a Domino is considered to be fine represented when appears only
	 * once on the board (so it has two associated locations)
	 */
	this.isOk = function(){
		return this.locations.length==2;
	}
	//Disassociates any currently associated location
	this.clear = function(){
		this.locations.length=0;
		this.getHtmlElement().className=this.getClass();	
	}
	//returns the id of the associated html element.
	this.getId = function(){
		if (!this.id){
			this.id="piece_"+this.a+"_"+this.b;
		}
		return this.id;
	}
	//returns the class of the associated html element
	this.getClass = function(){
		var ret='piece';
		if (this.locations.length>0){
			ret+=this.isOk()? 'Ok' : 'Error';
		}
		return ret;
	}
	//returns the html element
	this.getHtmlElement=function(){
		if (!this.htmlElement){
			this.htmlElement = document.getElementById(this.getId());
		}
		return this.htmlElement;
	}
}

/**
 * A Cell is a single cell on the Board<br>
 * It is associated to a Html element, modifying its appearance by updating
 * its class.<br>
 * At any single moment, a cell can be unlinked -single-, or linked to another
 * cell<br>
 * This function is its constructor
 */
function Cell(content, row, column){
	/**
	 * the state of a single cell. Together with the linkDirection it defines
	 * the class of this cell. <br>
	 * The state 'highlighted' means that it will be linked to other cell
	 * (it is associated to the hovering of the mouse on that cell)<br>
	 * From Normal, a cell can only pass to highlighted, and then to any other
	 * state.
	 */
	State={NORMAL:0, HIGHLIGHTED:1, LINKED:2, ERROR:3, SOLVED:4}
	
	this.id='board_'+row+'_'+column;
	this.state=State.NORMAL;
	this.linkDirection=LinkDirection.UP;
	this.link=null;
	this.number=content;
	this.toString = function(){
		return this.number;
	}
	this.getNumber = function(){
		return this.number;
	}
	this.isLinked = function(){
		return this.state>=State.LINKED;
	}
	this.isHighlighted = function(){
		return this.state==State.HIGHLIGHTED;
	}
	/**
	 * removes any link, setting the state to normal.<br>
	 * It also reinstates the click event (removed on setSolved)
	 */
	this.clear=function(){
		this.setNormal();
		this.getHtmlElement().onclick=board.mouseClick;		
	}
	/**
	 * Pre-links this cell to another one, updating automatically the
	 * class of the associated html element (and so its appearance)<br>
	 * This method also ensures that the other cell is 
	 * (pre) linked to this one<br>
	 * @param direction the direction of the link
	 * @param assoc the associated cell
	 */
	this.setHighlighted = function(direction, assoc){
		this.linkDirection = direction;
		this.state = State.HIGHLIGHTED;
		this.link = assoc;
		assoc.state = State.HIGHLIGHTED;
		assoc.link = this;
		switch(direction){
		case LinkDirection.UP:
			assoc.linkDirection=LinkDirection.DOWN;
			break;
		case LinkDirection.DOWN:
			assoc.linkDirection=LinkDirection.UP;
			break;
		case LinkDirection.RIGHT:
			assoc.linkDirection=LinkDirection.LEFT;
			break;
		case LinkDirection.LEFT:
			assoc.linkDirection=LinkDirection.RIGHT;
			break;
		}
		this.updateClass();
		assoc.updateClass();
	}
	/**
	 * This method sets the link state of a cell (as linked or 
	 * just highlighted (prelinked)).<br>
	 * It must always be invoked after a previous call to setHighlighted, to
	 * define the associated cell.<br>
	 * It also sets the link state on the associated cell, which is returned.
	 */
	this.setLinked = function(set){
		//can only be called after setHighlighted!
		this.state=set? State.LINKED : State.HIGHLIGHTED;
		this.link.state=this.state;
		this.updateClass();
		this.link.updateClass();
		return this.link;
	}
	/**
	 * Once a cell is linked, this method defines the state of the associated
	 * domino piece, as Ok or as an error (if the domino piece 
	 * is repeated).<br>
	 * The associated cell must be separately setDominoOk-ed as well.
	 */
	this.setDominoOk = function(ok){
		var st = ok? State.LINKED : State.ERROR;
		if (st!=this.state){
			this.state=st;
			this.updateClass();
		}
	}
	/**
	 * Informs that the whole puzzle is solved<br>
	 * The associated cell must receive the same call<br>
	 * The event for click is removed, to avoid further user interaction
	 */
	this.setSolved = function(){
		this.state = State.SOLVED;
		this.updateClass();
		this.getHtmlElement().onclick=null;		
	}
	/**
	 * Sets the state as normal (not linked)<br>
	 * The associated cell, if any, is returned (must be set as normal 
	 * separately)
	 */
	this.setNormal = function(){
		this.state = State.NORMAL;
		this.updateClass();
		return this.link;
	}
	this.getId=function(){
		return this.id;
	}
	this.updateClass = function(){
		this.getHtmlElement().className=this.getClass();
	}
	this.getHtmlElement=function(){
		if (!this.htmlElement){
			this.htmlElement = document.getElementById(this.id);
		}
		return this.htmlElement;
	}
	this.getClass = function(){
		var ret;
		switch (this.state){
		case State.NORMAL:
			return "locNormal";
		case State.HIGHLIGHTED:
			ret="locHighlighted";
			break;
		case State.LINKED:
			ret="locLinked";
			break;
		case State.ERROR:
			ret="locError";
			break;
		case State.SOLVED:
			ret="locSolved";
			break;
		}
		switch(this.linkDirection){
		case LinkDirection.UP:
			return ret+"Up";
		case LinkDirection.DOWN:
			return ret+"Down";
		case LinkDirection.RIGHT:
			return ret+"Right";
		case LinkDirection.LEFT:
			return ret+"Left";
		}
	}
}

/**
 * Method to convert the Html id of an element to coordinates in the board,
 * returned as an array {row, column}
 */
Cell.getCoordinates = function(id){
	refs = LOCATION_PATTERN.exec(id);
	return new Array(parseInt(refs[1]),parseInt(refs[2]))
}

/**
 * The Board is the main instance on the game, representing the sets of cells
 * and the pieces to be placed.<br>
 */
function Board(t){
	
	//last [current] known location, where the mouse points out
	var location = null;
	//the coordinates of the location, as an array [row, column]
	var locationCoordinates = null;

	/**
	 * Method called when the mouse enters a cell in the board
	 */
	this.mouseIn = function(event){
		//obtain the coordinates, with some code to handle IE.
		refs = Cell.getCoordinates(event.target? event.target.id : 
												 event.srcElement.id);
		loc = this.locations[refs[0]][refs[1]];
		if (!loc.isLinked()){
			//search will contain the direction on which to search for the
			//associated cell. It depends on which was the latest visited cell
			//and on the state of each neighbor cell (if a neighbor cell is
			//already linked, cannot be associated to the current one)
			var search=new Array(	LinkDirection.DOWN, LinkDirection.RIGHT, 
									LinkDirection.UP, LinkDirection.LEFT);
			if (locationCoordinates!=null){
				if (locationCoordinates[0]==refs[0]){
					if (locationCoordinates[1]>refs[1]){
						search=new Array(LinkDirection.RIGHT,LinkDirection.LEFT, 
								LinkDirection.DOWN, LinkDirection.UP);
					} else {
						search=new Array(LinkDirection.LEFT,LinkDirection.RIGHT, 
								LinkDirection.DOWN, LinkDirection.UP);
					}
				} else if (locationCoordinates[1]==refs[1]){
					if (locationCoordinates[0]>refs[0]){
						search=new Array(LinkDirection.DOWN, LinkDirection.UP, 
								LinkDirection.RIGHT, LinkDirection.LEFT);
					} else {
						search=new Array(LinkDirection.UP, LinkDirection.DOWN, 
								LinkDirection.RIGHT, LinkDirection.LEFT);
					}					
				}
			}
			for (s in search){
				var row, col;
				switch(search[s]){
				case LinkDirection.LEFT:
					row=refs[0];
					col=refs[1]-1;
					break;
				case LinkDirection.RIGHT:
					row=refs[0];
					col=refs[1]+1;
					break;
				case LinkDirection.UP:
					row=refs[0]-1;
					col=refs[1];
					break;
				case LinkDirection.DOWN:
					row=refs[0]+1;
					col=refs[1];
					break;
				}
				if (row>=0 && row<this.locations.length && 
				    col>=0 && col<this.locations[0].length){
					var assoc = this.locations[row][col];
					if (!assoc.isLinked()){
						//good candidate found, mark both as highlighted
						loc.setHighlighted(search[s], assoc);
						break;
					}
				}
			}
		}
		//whatever is the outcome, keep memory of the current visited cell
		location=loc;
		locationCoordinates=refs;
	}
	
	/**
	 * Method called when the mouse clicks a cell. It is always called after
	 * the mouseIn event, when the mouse enters the cell
	 */
	this.mouseClick = function(){
		/**
		 * Method to locate the piece index (in board.pieces), containing
		 * the numbers a, b. It is a simple fibonacci sequence, of course.
		 */
		function locate(a, b){
			if (a<b){
				var c=a;
				a=b;
				b=c;
			}
			while(a>0){
				b+=a--;
			}
			return board.pieces[b]; 
		}
		//a click implies an action only if it is performed on a highlighted
		// location (meaning it can be linked), or on a linked one (meaning
		// it will become unlinked)
		var nextLinked = !location.isLinked();
		if (!nextLinked || location.isHighlighted()){
			var assoc = location.setLinked(nextLinked);
			var piece=locate(location.getNumber(), assoc.getNumber());
			piece.onLocation(location, assoc, nextLinked);
			//if a new link is created, perhaps the solution was achieved:
			if (nextLinked){
				board.checkSolution();
			}
		}
	}
	
	/**
	 * Method called when the mouse leaves a cell. Its only action is to
	 * remove the highlight on a location couple, if not yet linked
	 */
	this.mouseOut = function(){
		if (location!=null && location.isHighlighted()){
			location.setNormal().setNormal();
		}
	}

	/**
	 * Creates the board's html elements (cells) on the HTML document,
	 * removing the previous one if necessary.
	 */
	this.createBoardInDocument = function(){
		var table = document.getElementById('board');
		while (table.rows.length>0){
			table.deleteRow(0);
		}
		for (var i in locations){
			var row = table.insertRow(i);
			var content = locations[i];
			for (var j=0;j<content.length;j++){
				var cell = row.insertCell(j);
				var location = content[j];
				cell.innerHTML=location.getNumber();
				cell.setAttribute('id',location.getId());
				cell.className=location.getClass();
				cell.onmouseover=function(event){
					board.mouseIn(event? event : window.event);
				};
				cell.onmouseout=board.mouseOut;
				cell.onclick=board.mouseClick;		
			}
		}
	}
	
	/**
	 * Creates the board's html elements (domino pieces) on the HTML document,
	 * removing the previous one if necessary.
	 */
	this.createPiecesInDocument = function(){
		var table = document.getElementById('pieces');
		while (table.rows.length>0){
			table.deleteRow(0);
		}
		var line = 0;
		var iline = 0;
		var row;
		for (var i in this.pieces){
			if (iline>=line){				
				row = table.insertRow(line++);
				iline=0;				
			}
			var cell = row.insertCell(iline++);
			var piece = this.pieces[i];
			cell.innerHTML=piece.toString();
			cell.setAttribute('id', piece.getId());
			cell.className=piece.getClass();
		}		
	}
	
	/**
	 * Verifies if the board contains a solution (all the pieces are included
	 * in the solution). If so, it sets the boatd to solved
	 */
	this.checkSolution = function(){
		for (var p in this.pieces){
			if (!pieces[p].isOk()){
				return;
			}
		}
		this.setSolved();
	}
	
	/**
	 * Sets all the locations as solved
	 */
	this.setSolved=function(){
		for (var r in this.locations){
			var row = this.locations[r];
			for (var c in row){
				row[c].setSolved();
			}
		}		
	}
	
	/**
	 * Sets all the locations as normal, as well as the domino' pieces
	 */
	this.clear=function(){
		for (var p in this.pieces){
			pieces[p].clear();
		}
		for (var r in this.locations){
			var row = this.locations[r];
			for (var c in row){
				row[c].clear();
			}
		}		
	}
	
	/**
	 * Shows the solution to the puzzle in the board
	 */
	this.showSolution=function(){
		this.clear();
		for (var s in this.solution){
			var sol = solution[s];
			var a = this.locations[sol[0]][sol[1]];
			var direction;
			var b;
			if (sol[2]){
				direction=LinkDirection.RIGHT;
				b=this.locations[sol[0]][sol[1]+1];
			} else {
				direction=LinkDirection.DOWN;
				b=this.locations[sol[0]+1][sol[1]];				
			}
			a.setHighlighted(direction, b);
			a.setLinked(true);
		}
		this.setSolved();
	}
	
	
	/**
	 * Method used during the creation of the puzzle to shuffle an array<br>
	 * Note that the initial array is modified, all its pieces become null.
	 */
	function shuffle(pieces){
		var limit = pieces.length;
		pieces=pieces.slice(0);
		function getPiece(n){
			while (n < limit){
				var ret = pieces[n];
				if (ret!=null){
					pieces[n]=null;
					return ret;
				}
				++n;
			}
			return getPiece(0);
		}
		var ret = new Array();
		var index = 0;
		while (index < limit){
			ret[index++] = getPiece(Math.floor(Math.random()*limit));
		}
		return ret;
	}
	
	/**
	 * Recursive method (max recursion is 27, no big deal) to locate a piece
	 * on the board. It is called to place the piece 'i' from the board on the
	 * location (h, v), and it can try both horizontal / vertical positions
	 * (which does radomly). If this fails, it will return false. <br>
	 * If it succeeds, it will try to locate the next piece on the next 
	 * location (moving right, or down if at the rightest place), 
	 * recursively.<br>
	 * It is succeeds, it just returns true.
	 */
	function locatePiece(pieces, i, h, v){
	    if (i<0) return true; //all pieces placed!

	    while (h>tPlus1 || locations[v][h]!=null){
	        h+=1;
	        if (h>tPlus1){
	            h=0;
	            v+=1;
	        }
		}
	    //firstDirection: direction to try first; 0: down, 1: right
	    var firstDirection = Math.random()<.5? 0 : 1;
	    var direction=firstDirection;
        for (var each = 0; each<2; each++){
        	if (direction) {
        		//right direction. Not valid if on the last column, or the
        		//location at the right is already occuped bya piece
        		if (h<tPlus1 && locations[v][h+1]==null){
	                locations[v][h+1]=new Cell(
	                		firstDirection? pieces[i].a : pieces[i].b, v, h+1);
	                if (locatePiece(pieces, i-1, h+2, v)){
	                    locations[v][h]=new Cell(
	                    		firstDirection? pieces[i].b:pieces[i].a, v, h);
	                    solution.push(new Array(v, h, true));
	                    return true;
	                }	                
	                locations[v][h+1]=null;
        		}
        	} else if (v<t){
        		//down direction, not valid if on the last row (no need to
        		//check if the location is already occupied!)
	            locations[v+1][h]=new Cell(
	            		firstDirection? pieces[i].a : pieces[i].b, v+1, h);
	            if (locatePiece(pieces, i-1, h+1, v)){
	                locations[v][h]=new Cell(
	                		firstDirection? pieces[i].b : pieces[i].a, v, h);
                    solution.push(new Array(v, h, false));
                    return true;
	            }
	            locations[v+1][h]=null;                
        	}
        	direction=1-direction;
        }
        return false;
	}
	
	//creation of the board
	var tPlus1 = t+1
	var locations = new Array();
	this.pieces = new Array();
	for (n=0; n<=t;n++){
		locations[n] = new Array();
		for (m=0; m<=n; m++){
			this.pieces.push(new Domino(n, m));
		}
	}
	this.locations=locations;
	var solution = this.solution= new Array();
	{
		var pieces = shuffle(this.pieces);
		if (!locatePiece(pieces, pieces.length-1, 0, 0)){
			throw 'Error creating locations';
		}
	}
	return this;
}

/**
 * Creation function, invoked to create a new full board, using the
 * dimensions defined the the SELECT input element (btype)
 */
function recreateBoard()
{
	var obj = document.getElementById('btype');
	board = Board(parseInt(obj.options[obj.selectedIndex].value));
	board.createBoardInDocument();
	board.createPiecesInDocument();
}


recreateBoard();
board.showSolution();
