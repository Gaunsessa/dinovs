package main

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
)

var UPGRADER = websocket.Upgrader{
	ReadBufferSize: 1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Lobby struct {
	p1, p2 *websocket.Conn

	// ttl float32
}

var LOBBIES = make(map[int]*Lobby)

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := UPGRADER.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println(err)

		return
	}

	gameId, err := strconv.Atoi(r.URL.Query().Get("lobby"));
	if err != nil {
		conn.WriteMessage(websocket.TextMessage, []byte("9|Invalid Lobby ID"))

		conn.Close()

		return
	}

	var lob *Lobby

	if l, ok := LOBBIES[gameId]; ok {
		lob = l
	} else {
		LOBBIES[gameId] = new(Lobby)
		lob = LOBBIES[gameId]
	}

	if lob.p1 != nil && lob.p2 != nil {
		conn.WriteMessage(websocket.TextMessage, []byte("9|Lobby Full"))

		conn.Close()

		return
	}

	var opponent **websocket.Conn
	var player **websocket.Conn

	if lob.p1 != nil {
		lob.p2 = conn

		player   = &lob.p2
		opponent = &lob.p1
	} else {
		lob.p1 = conn

		player   = &lob.p1
		opponent = &lob.p2
	}

	if *opponent != nil {
		// Join Packet
		(*opponent).WriteMessage(websocket.TextMessage, []byte("4|1"))
		(*player).WriteMessage(websocket.TextMessage, []byte("4|1"))
	}

	for {
		ty, msg, err := conn.ReadMessage()
		if err != nil {
			*player = nil

			if *opponent != nil {
				// Leave Packet
				(*opponent).WriteMessage(websocket.TextMessage, []byte("4|0"))
			}

			conn.Close()

			return
		}

		if ty != websocket.TextMessage {
			conn.WriteMessage(websocket.TextMessage, []byte("9|Packet Error"))

			*player = nil

			conn.Close()

			return
		}

		if *opponent != nil {
			(*opponent).WriteMessage(websocket.TextMessage, msg)
			(*player).WriteMessage(websocket.TextMessage, []byte("4|1"))
		}
	}
}

func updateLobbies() {
	for {
		for k, v := range LOBBIES {
			if v.p1 == nil && v.p2 == nil {
				delete(LOBBIES, k)

				fmt.Println("Lobby Deleted")
			}
		}

		time.Sleep(time.Second * 5);
	}
}

func main() {
	go updateLobbies()

	http.HandleFunc("/ws", wsHandler)
	http.Handle("/", http.FileServer(http.Dir("client")))

	err := http.ListenAndServe("0.0.0.0:2222", nil)
	if err != nil {
		fmt.Println("Server Failed To Start!")
	}
}