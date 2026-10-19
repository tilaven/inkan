"""Event publishing for Acme services (sample code that references decision records)."""

from dataclasses import dataclass


@dataclass
class Event:
    key: str
    payload: bytes


class Producer:
    # @adr platform/adr/0009-move-the-event-bus-to-kafka
    # Every event goes through Kafka; the partition key is the aggregate id so ordering holds per aggregate.
    def publish(self, topic: str, event: Event) -> None:
        raise NotImplementedError

    # Settlement consumers replay from the last committed offset, see @adr PAYMENTS-RFC-0001.
    def replay(self, topic: str, from_offset: int) -> None:
        raise NotImplementedError
