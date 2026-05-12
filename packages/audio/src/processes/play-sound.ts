import { Process, ProcessSystem, ProcessState } from '@2817/process'
import type { IProcessManager } from '@2817/process'
import type { ISoundPlayer } from '../types'

const TYPE = 'PlaySound'

export class PlaySoundProcess extends Process {
	readonly type = TYPE

	readonly soundName: string

	readonly waitForFinish: boolean = true

	soundId = -1

	constructor(soundName: string, waitForFinish = true) {
		super()

		this.soundName = soundName
		this.waitForFinish = waitForFinish
	}
}

export class PlaySoundProcessSystem extends ProcessSystem<PlaySoundProcess> {
	readonly type = TYPE

	private readonly soundPlayer: ISoundPlayer

	constructor(manager: IProcessManager, soundPlayer: ISoundPlayer) {
		super(manager)
		this.soundPlayer = soundPlayer
	}

	update(_dt: number): void {
		for (let i = this.processes.length - 1; i >= 0; --i) {
			const p = this.processes[i]
			switch (p.state) {
				case ProcessState.Idle:
					p.soundId = this.soundPlayer.play(p.soundName)
					if (p.soundId === -1) {
						// Sound not available (muted, not loaded, context suspended) — succeed so chain continues.
						p.state = ProcessState.Succeeded
						break
					}

					if (!p.waitForFinish) {
						p.state = ProcessState.Succeeded
						break
					}

					p.state = ProcessState.Running
					break
				case ProcessState.Running:
					if (this.soundPlayer.isSoundPlaying(p.soundId)) {
						continue
					}
					p.state = ProcessState.Succeeded
					break
				case ProcessState.Succeeded:
					this.handleNextProcesses(p)
					this.removeAt(i)
					break
				case ProcessState.Failed:
				case ProcessState.Aborted:
					this.removeAt(i)
					break
			}
		}
	}
}
